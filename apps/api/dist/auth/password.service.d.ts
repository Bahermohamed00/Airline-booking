export declare class PasswordService {
    private readonly SALT_ROUNDS;
    hash(password: string): Promise<string>;
    verify(password: string, hash: string): Promise<boolean>;
}
