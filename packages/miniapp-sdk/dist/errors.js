export class QChatError extends Error {
    code;
    details;
    constructor(code, message, details) {
        super(message || code);
        this.name = "QChatError";
        this.code = code;
        this.details = details;
    }
    toJSON() {
        return { code: this.code, message: this.message, details: this.details };
    }
}
export function isQChatError(error) {
    return error instanceof QChatError;
}
//# sourceMappingURL=errors.js.map