import type { RequestHandler } from './$types';
import { deleteTTSFile } from '$lib/sent/deleteTTS';

export const DELETE: RequestHandler = async (event) => {
    return deleteTTSFile(event);
};
