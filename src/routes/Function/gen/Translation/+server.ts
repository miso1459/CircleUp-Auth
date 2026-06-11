import type { RequestHandler } from './$types';
import { deleteTranslation } from '$lib/sent/deleteTranslation';

export const DELETE: RequestHandler = async (event) => {
    return deleteTranslation(event);
};
