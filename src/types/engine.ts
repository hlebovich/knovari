import type { UseBoundStore } from "zustand/react";
import type { StoreApi } from "zustand/vanilla";
import type { ApiService } from "../services/Api.service.ts";
import type { LoggerService } from "../services/Logger.service.ts";
import type { PresentationService } from "../services/Presentation.service.ts";
import type { ChangelogState } from "../stores/ChangelogStore.ts";
import type { ChangelogItem, TreatmentAction } from "./changelog.ts";

export interface EngineContext {
  store: UseBoundStore<StoreApi<ChangelogState>>;
  api: ApiService<unknown>;
  ppt: PresentationService;
  logger: LoggerService | Console;
}

export type UpdatedSlideIdItem = { initialId: string; updatedId: string };

export type TransformResult = {
  items: ChangelogItem[];
  unprocessedItems: ChangelogItem[];
  updatedSlideIds?: UpdatedSlideIdItem[];
};

export type TransformFn = (
  items: ChangelogItem[],
  context: EngineContext
) => Promise<TransformResult>;

export type TransformAction = TreatmentAction | "revert";

export type TransformSet = {
  [key in TransformAction]: TransformFn;
};
