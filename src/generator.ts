export type TargetLanguage = 'python' | 'javascript' | 'go' | 'rust' | 'java';

export interface GeneratedCode {
    language: TargetLanguage;
    displayName: string;
    code: string;
}

export function generateCode(pattern: string, language: TargetLanguage): GeneratedCode {
    const escaped = escapeForLanguage(pattern, language);

    switch (language) {
        case 'python':
            return {
                language,
                displayName: 'Python',
                code: `import re

pattern = re.compile(r"${escaped}")
match = pattern.search(text)
if match:
    print(match.group())`
            };

        case 'javascript':
            return {
                language,
                displayName: 'JavaScript',
                code: `const pattern = /${escaped}/;
const match = text.match(pattern);
if (match) {
    console.log(match[0]);
}`
            };

        case 'go':
            return {
                language,
                displayName: 'Go',
                code: `import "regexp"

pattern := regexp.MustCompile(\`${escaped}\`)
match := pattern.FindString(text)
if match != "" {
    fmt.Println(match)
}`
            };

        case 'rust':
            return {
                language,
                displayName: 'Rust',
                code: `use regex::Regex;

let pattern = Regex::new(r"${escaped}").unwrap();
if let Some(m) = pattern.find(text) {
    println!("{}", m.as_str());
}`
            };

        case 'java':
            return {
                language,
                displayName: 'Java',
                code: `import java.util.regex.*;

Pattern pattern = Pattern.compile("${escaped}");
Matcher matcher = pattern.matcher(text);
if (matcher.find()) {
    System.out.println(matcher.group());
}`
            };
    }
}

function escapeForLanguage(pattern: string, language: TargetLanguage): string {
    switch (language) {
        case 'python':
        case 'rust':
            return pattern.replace(/\\/g, '\\\\').replace(/"/g, '\\"');
        case 'javascript':
            return pattern.replace(/\//g, '\\/');
        case 'go':
            return pattern.replace(/`/g, '` + "`" + `');
        case 'java':
            return pattern.replace(/\\/g, '\\\\').replace(/"/g, '\\"');
    }
}