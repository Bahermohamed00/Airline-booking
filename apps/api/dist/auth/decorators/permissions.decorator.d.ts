export interface PermissionRequirement {
    resource: string;
    action: string;
}
export declare const PERMISSIONS_KEY = "permissions";
export declare const Permissions: (...permissions: PermissionRequirement[]) => import("@nestjs/common").CustomDecorator<string>;
