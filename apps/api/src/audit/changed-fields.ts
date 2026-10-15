/**
 * class-transformer's exposeUnsetFields default leaves every optional DTO
 * field explicitly undefined on the validated instance, so Object.keys alone
 * would report fields the client never sent. Only defined values count as
 * changed for audit metadata.
 */
export function changedFieldsOf<T extends object>(dto: T): (keyof T)[] {
  return (Object.keys(dto) as (keyof T)[]).filter((key) => dto[key] !== undefined);
}
