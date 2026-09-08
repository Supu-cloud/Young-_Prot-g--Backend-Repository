import { readFileSync } from 'node:fs';

const messageFile = process.argv[2];

if (!messageFile) {
    console.error('Commit message file was not provided.');
    process.exit(1);
}

const message = readFileSync(messageFile, 'utf8').trim();
const firstLine = message.split(/\r?\n/, 1)[0];
const conventionalCommit =
    /^(feat|fix|docs|style|refactor|perf|test|build|ci|chore|revert)(\([a-z0-9._/-]+\))?!?: .+$/;
const generatedCommit = /^(Merge |Revert \")/;

if (
    firstLine.length > 100 ||
    (!conventionalCommit.test(firstLine) && !generatedCommit.test(firstLine))
) {
    console.error(
        [
            'Invalid commit message.',
            'Use: <type>(optional-scope): <description>',
            'Example: feat(auth): add login endpoint',
            'Allowed types: feat, fix, docs, style, refactor, perf, test, build, ci, chore, revert',
            'Keep the first line at 100 characters or fewer.',
        ].join('\n')
    );
    process.exit(1);
}
