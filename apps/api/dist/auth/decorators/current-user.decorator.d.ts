export interface AuthUser {
    userId: string;
    email: string;
    roles: string[];
    permissions: string[];
}
export declare const CurrentUser: (...dataOrPipes: unknown[]) => ParameterDecorator;
