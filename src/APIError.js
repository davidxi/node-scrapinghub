import Log from 'log';
import TypedError from "error/typed";

export default TypedError({
    type: 'scrpyinghub',
    message: '{message} , status={statusCode}',
    title: null,
    statusCode: null
});

export const Logger = new Log('scrapinghub');