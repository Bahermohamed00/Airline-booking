import { SetMetadata } from '@nestjs/common';
export const PERMISSIONS_KEY = 'permissions';
export const Permissions = (...permissions) => SetMetadata(PERMISSIONS_KEY, permissions);
//# sourceMappingURL=permissions.decorator.js.map