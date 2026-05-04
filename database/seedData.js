import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const seedDataPath = path.resolve(__dirname, "./seed_data.json");
const seedData = JSON.parse(fs.readFileSync(seedDataPath, "utf8"));

function buildCitationPairs(publications) {
  const sortedPublications = [...publications].sort((left, right) => left.year - right.year || left.id - right.id);
  const pairs = [];
  const boostedPublicationIds = new Set([301, 302, 303, 304, 305, 307, 310, 314]);

  for (let index = 0; index < sortedPublications.length; index += 1) {
    const publication = sortedPublications[index];
    const earlierPublications = sortedPublications.slice(0, index);

    if (earlierPublications.length === 0) {
      continue;
    }

    const sameVenue = earlierPublications.filter((candidate) => candidate.venueId === publication.venueId);
    const sharedAuthor = earlierPublications.filter((candidate) =>
      candidate.authorIds.some((authorId) => publication.authorIds.includes(authorId))
    );
    const boostedCandidates = earlierPublications.filter((candidate) => boostedPublicationIds.has(candidate.id));
    const candidateIds = [
      earlierPublications.at(-1)?.id,
      earlierPublications.at(-2)?.id,
      sameVenue.at(-1)?.id,
      sharedAuthor.at(-1)?.id,
      earlierPublications[Math.floor(earlierPublications.length / 2)]?.id
    ].filter(Boolean);
    candidateIds.push(...boostedCandidates.slice(-5).map((candidate) => candidate.id));

    for (const targetId of [...new Set(candidateIds)]) {
      if (targetId !== publication.id) {
        pairs.push([publication.id, targetId]);
      }
    }
  }

  return pairs;
}

export const graphs = seedData.graphs;
export const institutions = seedData.institutions;
export const authors = seedData.authors;
export const venues = seedData.venues;
export const publications = seedData.publications;
export const citationPairs = buildCitationPairs(seedData.publications);
