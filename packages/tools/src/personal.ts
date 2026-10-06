/** The categories of personal data that code removes from a prompt before each model call, unless
 * the task of the call needs one. The call record stores the categories that its prompt still held,
 * and a CHECK of that column holds the same five words, so a test holds the two lists equal. */
export const PERSONAL_KEYS = [
  'date_of_birth',
  'address',
  'identity_number',
  'phone',
  'email',
] as const;

export type PersonalKey = (typeof PERSONAL_KEYS)[number];

/** The attribute keys that hold each category. A claim of a machine reader never holds one: the
 * public record names a person and never adds a date of birth or an address to that name. A tax id
 * is absent, because it also names a company. */
export const PERSONAL_ATTRIBUTE_KEYS: Readonly<Record<PersonalKey, readonly string[]>> = {
  date_of_birth: ['date_of_birth', 'birth_date', 'dob'],
  address: ['address', 'home_address', 'postal_address', 'residence'],
  identity_number: ['identity_number', 'passport_number', 'national_id', 'snils'],
  phone: ['phone', 'phone_number', 'telephone'],
  email: ['email', 'e_mail'],
};

const ALL_ATTRIBUTE_KEYS = new Set(Object.values(PERSONAL_ATTRIBUTE_KEYS).flat());

/** True when an attribute key holds a category of personal data. */
export const isPersonalAttribute = (key: string): boolean => ALL_ATTRIBUTE_KEYS.has(key);
