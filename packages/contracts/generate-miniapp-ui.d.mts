export interface MiniappUiEnum {
  values: string[];
  aliases: Record<string, string>;
}

export interface MiniappUiComponent {
  props?: Record<string, string>;
  localProps?: Record<string, string>;
  events?: string[];
}

export interface MiniappUiContract {
  version: number;
  protocolVersion: number;
  protocolName: string;
  textNodeType: string;
  fragmentType: string;
  runtimeVersion: string;
  sdkVersion: string;
  permissions: Array<{ id: string; apis: string[] }>;
  hostMethods: Array<{ name: string; permission: string | null }>;
  events: string[];
  propEvents: Record<string, string>;
  baseProps: Record<string, string>;
  helperTypes: Record<string, string>;
  enums: Record<string, MiniappUiEnum>;
  components: Record<string, MiniappUiComponent>;
  styleKeys: Record<string, string>;
  styleEnumKeys: Record<string, string>;
}

export const repoRoot: string;
export const contractPath: string;
export function loadContract(file?: string): MiniappUiContract;
export function renderArtifacts(
  contract?: MiniappUiContract,
): Record<string, string>;
export function writeArtifacts(artifacts?: Record<string, string>): string[];
export function checkArtifacts(artifacts?: Record<string, string>): string[];
