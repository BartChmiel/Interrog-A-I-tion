import type { GroundingContextPack } from "./types";

export type GroundingPackDiff = {
  compareQuestionId: string | null;
  addedSourceIds: string[];
  removedSourceIds: string[];
  addedTopicIds: string[];
  removedTopicIds: string[];
  focusChanged: boolean;
  addedMaterialIds: string[];
  removedMaterialIds: string[];
};

function sortedUnique(values: string[]): string[] {
  return [...new Set(values)].sort();
}

function listDiff(before: string[], after: string[]): { added: string[]; removed: string[] } {
  const beforeSet = new Set(before);
  const afterSet = new Set(after);
  return {
    added: after.filter((value) => !beforeSet.has(value)),
    removed: before.filter((value) => !afterSet.has(value)),
  };
}

export function diffGroundingPacks(
  before: GroundingContextPack | null,
  after: GroundingContextPack,
  compareQuestionId: string | null,
): GroundingPackDiff | null {
  if (!before) {
    return null;
  }

  const sourceDiff = listDiff(before.allowed_source_ids, after.allowed_source_ids);
  const beforeTopicIds = before.topic_contexts.map((topic) => topic.topic_id);
  const afterTopicIds = after.topic_contexts.map((topic) => topic.topic_id);
  const topicDiff = listDiff(beforeTopicIds, afterTopicIds);
  const beforeMaterialIds = before.material_references.map((material) => material.material_id);
  const afterMaterialIds = after.material_references.map((material) => material.material_id);
  const materialDiff = listDiff(beforeMaterialIds, afterMaterialIds);

  return {
    compareQuestionId,
    addedSourceIds: sortedUnique(sourceDiff.added),
    removedSourceIds: sortedUnique(sourceDiff.removed),
    addedTopicIds: sortedUnique(topicDiff.added),
    removedTopicIds: sortedUnique(topicDiff.removed),
    focusChanged: before.focus_question_id !== after.focus_question_id,
    addedMaterialIds: sortedUnique(materialDiff.added),
    removedMaterialIds: sortedUnique(materialDiff.removed),
  };
}

export type GroundingTopicDiffState = "added" | "removed" | null;

export function groundingTopicDiffState(topicId: string, diff: GroundingPackDiff | null): GroundingTopicDiffState {
  if (!diff) {
    return null;
  }
  if (diff.addedTopicIds.includes(topicId)) {
    return "added";
  }
  if (diff.removedTopicIds.includes(topicId)) {
    return "removed";
  }
  return null;
}

export function groundingPackDiffHasChanges(diff: GroundingPackDiff): boolean {
  return (
    diff.focusChanged ||
    diff.addedSourceIds.length > 0 ||
    diff.removedSourceIds.length > 0 ||
    diff.addedTopicIds.length > 0 ||
    diff.removedTopicIds.length > 0 ||
    diff.addedMaterialIds.length > 0 ||
    diff.removedMaterialIds.length > 0
  );
}
