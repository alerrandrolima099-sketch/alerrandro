export declare function writeLog(params: {
    tenantId: string;
    userId?: string | null;
    action: string;
    resource: string;
    resourceId?: string | null;
    metadata?: Record<string, unknown>;
    ip?: string | null;
}): Promise<void>;
