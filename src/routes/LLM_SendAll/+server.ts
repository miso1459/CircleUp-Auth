import type { RequestHandler } from './$types';
import { deleteSentence } from '$lib/sent/delete';

export const DELETE: RequestHandler = async (event) => {
    return deleteSentence(event);
};
