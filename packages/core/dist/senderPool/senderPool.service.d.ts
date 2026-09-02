export declare class SenderPoolService {
    /** Tenta reservar um sender disponível para o tenant/instância informado. */
    acquireSender(tenantId: string, instanceId: string): Promise<{
        sender: any;
        lockToken: `${string}-${string}-${string}-${string}-${string}`;
    } | null>;
    /** Libera um sender previamente adquirido, validando o token do lock. */
    releaseSender(senderId: string, lockToken: string): Promise<void>;
    pause(tenantId: string, senderId: string): Promise<any>;
    markError(senderId: string): Promise<any>;
    list(tenantId: string): Promise<any>;
}
export declare const senderPoolService: SenderPoolService;
