import { EventElement, EventOptions } from './types';

const addFunction = 'addEventListener';
const removeFunction = 'removeEventListener';
// for old browsers
const attachFunction = 'attachEvent';
const detachFunction = 'detachEvent';

export const setEvent = <
    E extends EventElement,
    M extends E extends Window
        ? WindowEventMap
        : E extends Document
        ? DocumentEventMap
        : E extends HTMLElement
        ? HTMLElementEventMap
        : E extends VisualViewport
        ? VisualViewportEventMap
        : never,
    T extends keyof M,
>(
    el: E,
    name: T,
    handler: (this: E, ev: M[T]) => any,
    opt: EventOptions,
    detach?: boolean,
): void => {
    const anyEl = el as any;
    const supportsAdd = anyEl[addFunction] && anyEl[removeFunction];
    const supportsAttach =
        !supportsAdd && anyEl[attachFunction] && anyEl[detachFunction];

    if (supportsAdd || supportsAttach) {
        const remove = supportsAdd ? removeFunction : detachFunction;
        const add = supportsAdd ? addFunction : attachFunction;
        const fn = detach ? remove : add;

        if (supportsAdd) {
            anyEl[fn](name, handler, opt);
        } else {
            anyEl[fn](`on${name}`, handler);
        }
    }
};
