import { isFF } from 'src/utils/browser/firefox';
import { flags } from '@inject';
import { POLYFILLS_FEATURE } from 'generated/features';
import { F } from 'ts-toolbelt';
import {
    ArrayMap,
    FlatMap,
    FlatMapCallback,
    ForEach,
    MapCallback,
} from './types';
import { curry2, curry2SwapArgs } from '../function/curry';
import { reducePoly } from './reduce';
import { isArray } from './isArray';
import { toNativeOrFalse } from '../function/isNativeFunction';

const isLengthCorrect = (ctx: Window, method: Function) => {
    if (!isFF(ctx)) {
        return true;
    }

    /*
        <= v42 - "Expected int32 as second argument" METR-37094, METR-41438
        v43-v49 - Зависает при передаче { length: -1 } METRIKASUPP-12625
     */
    try {
        method.call({ 0: true, length: -(2 ** 32) + 1 }, () => {
            // eslint-disable-next-line no-throw-literal
            throw 1;
        });
    } catch {
        return false;
    }
    return true;
};

const nativeMap = toNativeOrFalse(Array.prototype.map, 'map');

export const mapPoly: ArrayMap = <T, U>(
    fn: MapCallback<T, U>,
    array: ArrayLike<T>,
) => {
    return reducePoly(
        (rawResult, item, i) => {
            const result = rawResult;
            result.push(fn(item, i));
            return result;
        },
        [],
        array as any[],
    );
};
const callNativeOrPolyMap =
    nativeMap && isLengthCorrect(window, Array.prototype.map)
        ? <T, U>(fn: MapCallback<T, U>, array: ArrayLike<T>) =>
              array && array.length > 0 ? nativeMap.call(array, fn) : []
        : mapPoly;

export const baseMap: ArrayMap = flags[POLYFILLS_FEATURE]
    ? callNativeOrPolyMap
    : <T, U>(fn: MapCallback<T, U>, array: ArrayLike<T>) =>
          array && array.length > 0 ? Array.prototype.map.call(array, fn) : [];
export const cMap = baseMap;

export const cForEach: ForEach = baseMap; // cForEach - тоже самое что cMap, но она может иметь сайд эффекты, cMap - чистая ф-ция

const nativeFlatMap = toNativeOrFalse(Array.prototype.flatMap, 'flatMap');

export const flatMapPoly: FlatMap = <T, U>(
    fn: FlatMapCallback<T, U>,
    array: ArrayLike<T>,
) => {
    return reducePoly<T, U[]>(
        (result, item, i) => {
            const fnResult = fn(item, i);
            return result.concat(isArray(fnResult) ? fnResult : [fnResult]);
        },
        [],
        array,
    );
};
const callNativeOrPolyFlatMap: FlatMap = nativeFlatMap
    ? <T, U>(fn: FlatMapCallback<T, U>, array: ArrayLike<T>) =>
          (nativeFlatMap as F.Function<[FlatMapCallback<T, U>], U[]>).call(
              array,
              fn,
          )
    : flatMapPoly;

export const flatMap: FlatMap = flags[POLYFILLS_FEATURE]
    ? callNativeOrPolyFlatMap
    : <T, U>(fn: FlatMapCallback<T, U>, array: ArrayLike<T>) =>
          (
              Array.prototype.flatMap as F.Function<
                  [FlatMapCallback<T, U>],
                  U[]
              >
          ).call(array, fn);

/**
 * @type function(...?): ?
 */
export const ctxMap: <T, R>(cb: (e: T, i: number) => R) => (arr: T[]) => R[] =
    curry2(cMap) as any;

export const ctxForEach: <T, R>(
    cb: (e: T, i: number) => R,
) => (arr: T[]) => void = curry2(cForEach) as any;

export const ctxMapSwap = curry2SwapArgs(cMap) as <T, R>(
    // eslint-disable-next-line no-use-before-define
    arr: T[],
) => (cb: (e: T, i: number) => R) => R[];
