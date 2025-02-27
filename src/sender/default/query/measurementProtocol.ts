import { TELEMETRY_FEATURE } from 'generated/features';
import { flags } from '@inject';
import { TRANSPORT_ID_BR_KEY, URL_PARAM } from 'src/api/common';
import {
    ARTIFICIAL_BR_KEY,
    EVENT_ACTION_KEY,
    EVENT_LABEL_KEY,
    EVENT_VALUE_KEY,
    HIT_TYPE_KEY,
    IS_DOWNLOAD_BR_KEY,
    IS_EXTERNAL_LINK_BR_KEY,
    NOT_BOUNCE_BR_KEY,
    NOT_BOUNCE_CLIENT_TIME_BR_KEY,
    PAGE_VIEW_BR_KEY,
    PARAMS_BR_KEY,
    SENDER_TIME_BR_KEY,
    TRACK_HASH_BR_KEY,
} from 'src/api/watch';
import { cFind, cReduce, includes } from 'src/utils/array';
import { BrowserInfo, browserInfo } from 'src/utils/browserInfo';
import { bindArg, equal, pipe } from 'src/utils/function';
import { entries, getPath, isNil, mix } from 'src/utils/object';
import { TimeOne, getSec } from 'src/utils/time';
import type { FindCallback } from 'src/utils/array/types';
import type { SenderInfo, UrlParams } from '../../SenderInfo';

const HIT_TYPE_EVENT = 'event';
const HIT_TYPE_PAGEVIEW = 'pageview';
const EVENT_ACTION_GOAL = 'goal';

/**
 * Public parameters as described by Measurement Protocol documentation - sent as is.
 */
const publicParameters = 'dl,cid,dr,dt,de,ul,tid,z,vp,sr,je'.split(',');

/**
 * These events are accompanied by 'ar' key.
 */
const artificialEvents = [
    PAGE_VIEW_BR_KEY,
    NOT_BOUNCE_BR_KEY,
    PARAMS_BR_KEY,
] as const;

/**
 * These event contain a single event key and are not a pageview.
 */
const simpleEvents = [IS_DOWNLOAD_BR_KEY, IS_EXTERNAL_LINK_BR_KEY] as const;

/**
 * The presence of any of these keys indicate a special event.
 */
const eventBrinfoKeys = [
    ARTIFICIAL_BR_KEY,
    NOT_BOUNCE_CLIENT_TIME_BR_KEY,
    ...artificialEvents,
    ...simpleEvents,
] as const;

/**
 * Choose event type based on the BrowserInfo flags.
 */
const processEvents = (
    brInfo: BrowserInfo,
    urlParams?: UrlParams,
): Record<string, string> => {
    const brInfoFlags = brInfo.ctx();
    const result: Record<string, string> = {};
    const findEventKey = bindArg(
        pipe(bindArg(brInfoFlags, getPath), equal(1)),
        // TODO change to cFind<string> when typescript is updated
        cFind as (
            fn: FindCallback<string>,
            array: ArrayLike<string>,
        ) => string | undefined,
    );

    if (!brInfoFlags[ARTIFICIAL_BR_KEY]) {
        if (brInfoFlags[PAGE_VIEW_BR_KEY]) {
            if (brInfoFlags[TRACK_HASH_BR_KEY]) {
                result[HIT_TYPE_KEY] = HIT_TYPE_EVENT;
                result[EVENT_ACTION_KEY] = TRACK_HASH_BR_KEY;
            } else {
                result[HIT_TYPE_KEY] = HIT_TYPE_PAGEVIEW;
            }
        } else {
            const eventKey = findEventKey(simpleEvents);
            if (eventKey) {
                result[HIT_TYPE_KEY] = HIT_TYPE_EVENT;
                result[EVENT_ACTION_KEY] = eventKey;
            }
        }
    } else {
        const artificialEventKey = findEventKey(artificialEvents);
        if (artificialEventKey) {
            result[HIT_TYPE_KEY] = HIT_TYPE_EVENT;
            result[EVENT_ACTION_KEY] = artificialEventKey;
            if (
                artificialEventKey === NOT_BOUNCE_BR_KEY &&
                brInfoFlags[NOT_BOUNCE_CLIENT_TIME_BR_KEY]
            ) {
                result[
                    EVENT_VALUE_KEY
                ] = `${brInfoFlags[NOT_BOUNCE_CLIENT_TIME_BR_KEY]}`;
            }
        } else if (urlParams) {
            result[HIT_TYPE_KEY] = HIT_TYPE_EVENT;
            result[EVENT_ACTION_KEY] = EVENT_ACTION_GOAL;
            result[EVENT_LABEL_KEY] = urlParams[URL_PARAM];
            delete urlParams[URL_PARAM];
        }
    }

    return result;
};

/**
 * Maps an object into a Measurement Protocol compliant one.
 */
const mapURLParameters = (
    urlParams: Record<string, string | number | null>,
): Record<string, string> =>
    cReduce(
        (acc, [key, value]) => {
            if (!includes(key, eventBrinfoKeys) && !isNil(value)) {
                const newKey = includes(key, publicParameters)
                    ? key
                    : `_${key}`;
                acc[newKey] = `${value}`;
            }

            return acc;
        },
        {} as Record<string, string>,
        entries(urlParams),
    );

/**
 * Creates a search query for a transport compliant with Measurement Protocol.
 * URL are appended with key-value pairs from BrowserInfo and Telemetry storages.
 */
export const createMPQuery = (
    ctx: Window,
    senderInfo: SenderInfo,
    transportID: number,
) => {
    const query = mapURLParameters(senderInfo.urlParams || {});
    const time = TimeOne(ctx);

    if (senderInfo.brInfo) {
        mix(
            query,
            mapURLParameters(
                browserInfo(senderInfo.brInfo.ctx())
                    .setVal(SENDER_TIME_BR_KEY, time(getSec))
                    .ctx(),
            ),
            processEvents(senderInfo.brInfo, senderInfo.urlParams),
        );
    }

    if (flags[TELEMETRY_FEATURE]) {
        const { telemetry } = senderInfo;
        if (telemetry) {
            mix(
                query,
                mapURLParameters(
                    telemetry.setVal(TRANSPORT_ID_BR_KEY, transportID).ctx(),
                ),
            );
        }
    }

    return query;
};
