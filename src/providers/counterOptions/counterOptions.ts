import {
    ARTIFICIAL_HIT_FEATURE,
    PARAMS_FEATURE,
    SEND_TITLE_FEATURE,
    TRIGGER_EVENT_FEATURE,
    USER_PARAMS_FEATURE,
    TRACK_HASH_FEATURE,
    EXTERNAL_LINK_FEATURE,
    ENABLE_ALL_METHOD_FEATURE,
} from 'generated/features';
import { entries, isObject, isUndefined } from 'src/utils/object';
import { cForEach, cReduce, isArray } from 'src/utils/array';
import { flags } from '@inject';
import { parseDecimalInt } from 'src/utils/number';
import type { CounterOption, CounterOptions } from 'src/utils/counterOptions';
import { DEFAULT_ID, DEFAULT_COUNTER_TYPE } from './const';
import type { OptionInitializerMap, OptionsKeysMaps } from './types';

export const obfuscatedKeysMap: Record<string, string> = {
    id: 'id',
    ut: 'ut',
    counterType: 'type',
    ldc: 'ldc',
    noCookie: 'nck',
    forceUrl: 'url',
    forceReferrer: 'referrer',
};

const COUNTER_ID_REGEX = /^\d+$/;

export const normalizeId = (rawCounterId: string | number): number => {
    let counterString = `${rawCounterId || DEFAULT_ID}`; // идентификатор счетчика
    if (!COUNTER_ID_REGEX.test(counterString)) {
        counterString = DEFAULT_ID;
    }
    let counterId: number;
    try {
        counterId = parseDecimalInt(counterString);
    } catch (e) {
        counterId = 0;
    }
    return counterId;
};

export const normalizeOptionsMap: Record<string, (value: any) => unknown> = {
    id: normalizeId,
    counterType: (value) =>
        `${value || value === 0 ? value : DEFAULT_COUNTER_TYPE}`,
    noCookie: Boolean,
    ut: Boolean,
};

if (flags[ARTIFICIAL_HIT_FEATURE]) {
    obfuscatedKeysMap.counterDefer = 'defer';
    normalizeOptionsMap.counterDefer = Boolean;
}

if (flags[PARAMS_FEATURE]) {
    obfuscatedKeysMap.params = 'params';
    normalizeOptionsMap.params = (value) =>
        isObject(value) || isArray(value) ? value : null;
}

if (flags[USER_PARAMS_FEATURE]) {
    obfuscatedKeysMap.userParams = 'userParams';
}

if (flags[TRIGGER_EVENT_FEATURE]) {
    obfuscatedKeysMap.triggerEvent = 'triggerEvent';
    normalizeOptionsMap.triggerEvent = Boolean;
}

if (flags[SEND_TITLE_FEATURE]) {
    obfuscatedKeysMap.sendTitle = 'sendTitle';
    normalizeOptionsMap.sendTitle = (value) =>
        Boolean(value) || isUndefined(value);
}

if (flags[TRACK_HASH_FEATURE]) {
    obfuscatedKeysMap.trackHash = 'trackHash';
    normalizeOptionsMap.trackHash = Boolean;
}

if (flags[EXTERNAL_LINK_FEATURE]) {
    obfuscatedKeysMap.trackLinks = 'trackLinks';
}

if (flags[ENABLE_ALL_METHOD_FEATURE]) {
    obfuscatedKeysMap.enableAll = 'enableAll';
}

/**
 * Normalization functions bound to params
 */
export const optionsKeysMap = cReduce(
    (acc: OptionsKeysMaps, [obfuscatedKey, optKey]) => {
        acc[obfuscatedKey] = {
            optKey,
            normalizeFunction: normalizeOptionsMap[obfuscatedKey],
        };
        return acc;
    },
    {},
    entries(obfuscatedKeysMap),
);

/**
 * Append counter options with new values.
 */
export const addCounterOptions = <T extends CounterOption>(
    options: OptionInitializerMap<T>,
) => {
    cForEach(([obfuscatedKey, initializer]) => {
        const { optKey, normalizeFunction } = initializer!;
        optionsKeysMap[obfuscatedKey] = {
            optKey,
            normalizeFunction,
        };
    }, entries(options));
};

export const getOriginalOptions = (
    counterOptions: CounterOptions,
): CounterOptions => {
    return cReduce(
        (futureOptions: Record<string, unknown>, [obfuscatedKey, value]) => {
            const { optKey } = optionsKeysMap[obfuscatedKey];

            futureOptions[optKey] = value;

            return futureOptions;
        },
        {},
        entries(counterOptions),
    ) as unknown as CounterOptions;
};
