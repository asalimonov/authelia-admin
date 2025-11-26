// Static constants for LDAP special characters
const FILTER_CHARS = {
    NUL: '\u0000',
    LPAREN: '\u0028',  // (
    RPAREN: '\u0029',  // )
    ASTERISK: '\u002a', // *
    BACKSLASH: '\u005c' // \
} as const;

const DN_CHARS = {
    SPACE: '\u0020',     // space
    QUOTE: '\u0022',     // "
    HASH: '\u0023',      // #
    PLUS: '\u002b',      // +
    COMMA: '\u002c',     // ,
    SEMICOLON: '\u003b', // ;
    LT: '\u003c',        // <
    EQUALS: '\u003d',    // =
    GT: '\u003e',        // >
    BACKSLASH: '\u005c'  // \
} as const;

const FILTER_REGEX = new RegExp(
    `[${Object.values(FILTER_CHARS).join('')}]`,
    'gm'
);

const DN_REGEX = new RegExp(
    `[${Object.values(DN_CHARS).join('')}]`,
    'gm'
);

interface Replacements {
    filter: Record<string, string>;
    dnBegin: Record<string, string>;
    dn: Record<string, string>;
    dnEnd: Record<string, string>;
}

const replacements: Replacements = {
    filter: {
        [FILTER_CHARS.NUL]: '\\00',
        [FILTER_CHARS.LPAREN]: '\\28',
        [FILTER_CHARS.RPAREN]: '\\29',
        [FILTER_CHARS.ASTERISK]: '\\2a',
        [FILTER_CHARS.BACKSLASH]: '\\5c'
    },

    /* distinguished name replacements */
    dnBegin: {
        [DN_CHARS.SPACE]: '\\ ', // SPC at beginning
    },
    dn: {
        [DN_CHARS.QUOTE]: '\\"',
        [DN_CHARS.HASH]: '\\#',
        [DN_CHARS.PLUS]: '\\+',
        [DN_CHARS.COMMA]: '\\,',
        [DN_CHARS.SEMICOLON]: '\\;',
        [DN_CHARS.LT]: '\\<',
        [DN_CHARS.EQUALS]: '\\=',
        [DN_CHARS.GT]: '\\>',
        [DN_CHARS.BACKSLASH]: '\\\\'
    },
    dnEnd: {
        [DN_CHARS.SPACE]: '\\ ' // SPC at end
    }
};

/**
 * Escapes a value for safe use in LDAP search filters
 * Prevents LDAP injection by escaping special characters
 * 
 * @param strings - Template literal strings
 * @param values - Template literal values to be escaped
 * @returns Safely escaped LDAP filter string
 * 
 * @example
 * ```typescript
 * const uid = "admin)(|(uid=*";
 * const safeFilter = filter`(&(objectClass=person)(uid=${uid}))`;
 * // Result: (&(objectClass=person)(uid=admin\29\28|\28uid=\2a))
 * ```
 */
export function filter(strings: TemplateStringsArray, ...values: unknown[]): string {
    let safe = '';
    strings.forEach((string, i) => {
        safe += string;
        if (values.length > i) {
            const value = String(values[i]);
            safe += value.replace(
                FILTER_REGEX,
                (ch) => replacements.filter[ch] || ch
            );
        }
    });
    return safe;
}

/**
 * Escapes a string value for safe use in LDAP search filters
 * Non-template literal version of the filter function
 * 
 * @param value - The value to escape
 * @returns Safely escaped string for LDAP filters
 * 
 * @example
 * ```typescript
 * const escapedUid = escapeFilter("admin)(|(uid=*");
 * const safeFilter = `(&(objectClass=person)(uid=${escapedUid}))`;
 * ```
 */
export function escapeFilter(value: string): string {
    return value.replace(
        FILTER_REGEX,
        (ch) => replacements.filter[ch] || ch
    );
}

/**
 * Escapes a value for safe use in LDAP distinguished names (DN)
 * Prevents LDAP injection in DN components
 * 
 * @param strings - Template literal strings
 * @param values - Template literal values to be escaped
 * @returns Safely escaped LDAP DN string
 * 
 * @example
 * ```typescript
 * const username = "admin,dc=evil";
 * const safeDn = dn`uid=${username},ou=people,dc=example,dc=com`;
 * // Result: uid=admin\,dc=evil,ou=people,dc=example,dc=com
 * ```
 */
export function dn(strings: TemplateStringsArray, ...values: unknown[]): string {
    let safe = '';
    strings.forEach((string, i) => {
        safe += string;
        if (values.length > i) {
            const value = String(values[i]);
            safe += value
                .replace(
                    /(\u0022|\u0023|\u002b|\u002c|\u003b|\u003c|\u003d|\u003e|\u005c)/gm,
                    (ch) => replacements.dn[ch] || ch
                )
                .replace(/^(\u0020)/gm, (ch) => replacements.dnBegin[ch] || ch)
                .replace(/(\u0020)$/gm, (ch) => replacements.dnEnd[ch] || ch);
        }
    });
    return safe;
}

/**
 * Escapes a string value for safe use in LDAP distinguished names
 * Non-template literal version of the dn function
 * 
 * @param value - The value to escape
 * @returns Safely escaped string for LDAP DNs
 * 
 * @example
 * ```typescript
 * const escapedUsername = escapeDn("admin,dc=evil");
 * const safeDn = `uid=${escapedUsername},ou=people,dc=example,dc=com`;
 * ```
 */
export function escapeDn(value: string): string {
    return value
        .replace(
            /(\u0022|\u0023|\u002b|\u002c|\u003b|\u003c|\u003d|\u003e|\u005c)/gm,
            (ch) => replacements.dn[ch] || ch
        )
        .replace(/^(\u0020)/gm, (ch) => replacements.dnBegin[ch] || ch)
        .replace(/(\u0020)$/gm, (ch) => replacements.dnEnd[ch] || ch);
}

export function isValidAttributeName(value: string): boolean {
    return /^[a-zA-Z][a-zA-Z0-9-]*$/.test(value);
}

export function validateAttributeName(attributeName: string): string {
    if (!isValidAttributeName(attributeName)) {
        throw new Error(`Invalid LDAP attribute name: ${attributeName}`);
    }
    return attributeName;
}