import versesData from "../../.github/prayrequest-verses.json";

export interface Verse {
	verse: string;
	ref: string;
}

interface VersesFile {
	verses: Array<Verse & { tags: string[] }>;
	default: Verse;
}

const data = versesData as VersesFile;

// Pre-compile each verse's tag patterns once. Mirrors the bash matcher:
// (^|[^[:alnum:]])tag([^[:alnum:]]|$). JS \b includes _, so use an
// explicit non-alnum class to keep parity with the shell script.
const compiledVerses = data.verses.map((v) => ({
	verse: v.verse,
	ref: v.ref,
	tags: v.tags,
	patterns: v.tags.map(
		(tag) =>
			new RegExp(
				`(?:^|[^a-z0-9])${tag.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}(?:[^a-z0-9]|$)`,
			),
	),
}));

export interface VerseInput {
	prTitle: string;
	additions: number;
	changedFiles: number;
	excludeRef?: string;
}

export function pickVerse({ prTitle, additions, changedFiles, excludeRef }: VerseInput): Verse {
	const titleLc = prTitle.toLowerCase();
	const isMassive = additions > 500 || changedFiles > 20;

	if (isMassive) {
		const massive = compiledVerses.find((v) => v.tags.includes("massive"));
		if (massive && massive.ref !== excludeRef) {
			return { verse: massive.verse, ref: massive.ref };
		}
	}

	for (const v of compiledVerses) {
		if (v.ref === excludeRef) continue;
		if (v.patterns.some((p) => p.test(titleLc))) {
			return { verse: v.verse, ref: v.ref };
		}
	}

	if (data.default.ref !== excludeRef) {
		return { verse: data.default.verse, ref: data.default.ref };
	}

	const fallback = compiledVerses.find((v) => v.ref !== excludeRef);
	if (fallback) return { verse: fallback.verse, ref: fallback.ref };
	return { verse: data.default.verse, ref: data.default.ref };
}

// Trailing HTML comment is the canonical anchor for reroll's exclude-ref
// lookup. Parsing visible markdown back out (the > —*ref* line) would
// silently break if formatting ever changes.
export function formatComment({ verse, ref }: Verse): string {
	return `> ${verse}\n> — *${ref}*\n\n*— 🙏 PrayRequest*\n<!-- prayrequest:ref=${ref} -->`;
}
