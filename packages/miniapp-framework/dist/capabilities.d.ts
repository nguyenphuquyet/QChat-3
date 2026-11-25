export type ApiCapability = {
    supported: boolean;
    bridge?: string;
    permissions?: string[];
    reason?: string;
};
export type ComponentCapability = {
    attributes: string[];
    values?: Record<string, string[]>;
};
export type CapabilityManifest = {
    permissions: string[];
    apis: Record<string, ApiCapability>;
    bridge: Record<string, string[]>;
    components: Record<string, ComponentCapability>;
};
export declare const API_CAPABILITIES: Record<string, ApiCapability>;
export declare const COMPONENT_CAPABILITIES: Record<string, ComponentCapability>;
export declare function buildCapabilities(declaredPermissions: string[]): CapabilityManifest;
//# sourceMappingURL=capabilities.d.ts.map