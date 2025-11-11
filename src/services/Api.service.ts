/* eslint-disable */
/* tslint:disable */
// @ts-nocheck
/*
 * ---------------------------------------------------------------
 * ## THIS FILE WAS GENERATED VIA SWAGGER-TYPESCRIPT-API        ##
 * ##                                                           ##
 * ## AUTHOR: acacode                                           ##
 * ## SOURCE: https://github.com/acacode/swagger-typescript-api ##
 * ---------------------------------------------------------------
 */

import type { ConfidenceScore, ShapeType, TreatmentAction } from "../types/changelog.ts";

const BASE_URL = import.meta.env.VITE_API_BASE_URL;

/** Body_sanitize_api_v1_tasks_sanitize_post */
export interface SanitizeRequest {
  /**
   * File
   * @format binary
   */
  file: File;
}

/** Body_upload_slide_screenshot_api_v1_screenshots__task_id___slide_number__post */
export interface UploadSlideScreenshotRequest {
  /**
   * File
   * @format binary
   */
  file: File;
}

/** Body_remove_presentation_metadata_api_v1_presentations_remove_metadata_post */
export interface RemovePresentationMetadataRequest {
  /**
   * File
   * @format binary
   */
  file: File;
}

/** ChangelogResponse */
export interface ChangelogResponse {
  /** Data */
  data: FinalChangelogData[];
}

/** ChartData */
export interface ChartData {
  /** Title */
  title?: string | null;
  /** Categories */
  categories: string[];
  /** Series */
  series: ChartSeries[];
}

/** ChartSeries */
export interface ChartSeries {
  /** Name */
  name: string;
  /** Values */
  values: number[];
}

/** FinalChangelogData */
export interface FinalChangelogData {
  /**
   * Id
   * Unique identifier for the changelog entry
   */
  id: number;
  /** Slideid */
  slideId: number;
  /** Slidenumber */
  slideNumber: number;
  /** Shapeid */
  shapeId: number;
  /**
   * Groupid
   * Identifier for a group of identical changes
   */
  groupId: number | null;
  shapeType: ShapeType;
  /**
   * Category
   * Category of confidential data (e.g., Direct Identifier, Financial data, Strategy/plans, Market signals, Terminology, Visuals)
   */
  category: string;
  /**
   * Rationale
   * Explanation of why the data is considered sensitive
   * @maxLength 64
   */
  rationale: string;
  /** Initialvalue */
  initialValue: string | ChartData;
  /** Proposedvalue */
  proposedValue: string | ChartData;
  /** Row */
  row?: number | null;
  /** Column */
  column?: number | null;
  /** Startindex */
  startIndex?: number | null;
  confidenceScore: ConfidenceScore;
  action?: TreatmentAction | null;
  /**
   * Isapplied
   * @default false
   */
  isApplied?: boolean;
  /** Userchange */
  userChange?: string | null;
  /** Obfuscationscale */
  obfuscationScale?: number | null;
}

/** FinalChangelogResponse */
export interface FinalChangelogResponse {
  /** Data */
  data: FinalChangelogData[];
  /** Screenshots */
  screenshots: string[];
  /** Sessiondurationseconds */
  sessionDurationSeconds: number;
}

/** HTTPValidationError */
export interface HTTPValidationError {
  /** Detail */
  detail?: ValidationError[];
}

/** TaskResponse */
export interface TaskResponse {
  /** Taskid */
  taskId: string;
}

/** TaskStatusResponse */
export interface TaskStatusResponse {
  /** Status */
  status: string;
  changelog?: ChangelogResponse | null;
}

/** UpdateChangelogRequest */
export interface UpdateChangelogRequest {
  /** Data */
  data: FinalChangelogData[];
}

export interface UploadPresentationFileOptions {
  /** Polling interval in milliseconds (default: 3000) */
  intervalMs?: number;
  /** Abort controller signal to cancel polling */
  signal?: AbortSignal;
}

/** TaskStatusResponse */
export interface UploadPresentationResponse {
  taskId: string;
  changelog: ChangelogResponse;
}

/** ValidationError */
export interface ValidationError {
  /** Location */
  loc: (string | number)[];
  /** Message */
  msg: string;
  /** Error Type */
  type: string;
}

export type QueryParamsType = Record<string | number, any>;
export type ResponseFormat = keyof Omit<Body, "body" | "bodyUsed">;

export interface FullRequestParams extends Omit<RequestInit, "body"> {
  /** set parameter to `true` for call `securityWorker` for this request */
  secure?: boolean;
  /** request path */
  path: string;
  /** content type of request body */
  type?: ContentType;
  /** query params */
  query?: QueryParamsType;
  /** format of response (i.e. response.json() -> format: "json") */
  format?: ResponseFormat;
  /** request body */
  body?: unknown;
  /** base url */
  baseUrl?: string;
  /** request cancellation token */
  cancelToken?: CancelToken;
}

export type RequestParams = Omit<FullRequestParams, "body" | "method" | "query" | "path">;

export interface ApiConfig<SecurityDataType = unknown> {
  baseUrl?: string;
  baseApiParams?: Omit<RequestParams, "baseUrl" | "cancelToken" | "signal">;
  securityWorker?: (
    securityData: SecurityDataType | null
  ) => Promise<RequestParams | void> | RequestParams | void;
  customFetch?: typeof fetch;
}

export interface HttpResponse<D extends unknown, E extends unknown = unknown> extends Response {
  data: D;
  error: E;
}

type CancelToken = Symbol | string | number;

export enum ContentType {
  Json = "application/json",
  JsonApi = "application/vnd.api+json",
  FormData = "multipart/form-data",
  UrlEncoded = "application/x-www-form-urlencoded",
  Text = "text/plain",
}

export class HttpClient<SecurityDataType = unknown> {
  public baseUrl: string = "";
  private securityData: SecurityDataType | null = null;
  private securityWorker?: ApiConfig<SecurityDataType>["securityWorker"];
  private abortControllers = new Map<CancelToken, AbortController>();
  private customFetch = (...fetchParams: Parameters<typeof fetch>) => fetch(...fetchParams);

  private baseApiParams: RequestParams = {
    credentials: "same-origin",
    headers: {},
    redirect: "follow",
    referrerPolicy: "no-referrer",
  };

  constructor(apiConfig: ApiConfig<SecurityDataType> = {}) {
    Object.assign(this, apiConfig);
  }

  public setSecurityData = (data: SecurityDataType | null) => {
    this.securityData = data;
  };

  protected encodeQueryParam(key: string, value: any) {
    const encodedKey = encodeURIComponent(key);
    return `${encodedKey}=${encodeURIComponent(typeof value === "number" ? value : `${value}`)}`;
  }

  protected addQueryParam(query: QueryParamsType, key: string) {
    return this.encodeQueryParam(key, query[key]);
  }

  protected addArrayQueryParam(query: QueryParamsType, key: string) {
    const value = query[key];
    return value.map((v: any) => this.encodeQueryParam(key, v)).join("&");
  }

  protected toQueryString(rawQuery?: QueryParamsType): string {
    const query = rawQuery || {};
    const keys = Object.keys(query).filter((key) => "undefined" !== typeof query[key]);
    return keys
      .map((key) =>
        Array.isArray(query[key])
          ? this.addArrayQueryParam(query, key)
          : this.addQueryParam(query, key)
      )
      .join("&");
  }

  protected addQueryParams(rawQuery?: QueryParamsType): string {
    const queryString = this.toQueryString(rawQuery);
    return queryString ? `?${queryString}` : "";
  }

  private contentFormatters: Record<ContentType, (input: any) => any> = {
    [ContentType.Json]: (input: any) =>
      input !== null && (typeof input === "object" || typeof input === "string")
        ? JSON.stringify(input)
        : input,
    [ContentType.JsonApi]: (input: any) =>
      input !== null && (typeof input === "object" || typeof input === "string")
        ? JSON.stringify(input)
        : input,
    [ContentType.Text]: (input: any) =>
      input !== null && typeof input !== "string" ? JSON.stringify(input) : input,
    [ContentType.FormData]: (input: any) => {
      if (input instanceof FormData) {
        return input;
      }

      return Object.keys(input || {}).reduce((formData, key) => {
        const property = input[key];
        formData.append(
          key,
          property instanceof Blob
            ? property
            : typeof property === "object" && property !== null
              ? JSON.stringify(property)
              : `${property}`
        );
        return formData;
      }, new FormData());
    },
    [ContentType.UrlEncoded]: (input: any) => this.toQueryString(input),
  };

  protected mergeRequestParams(params1: RequestParams, params2?: RequestParams): RequestParams {
    return {
      ...this.baseApiParams,
      ...params1,
      ...(params2 || {}),
      headers: {
        ...(this.baseApiParams.headers || {}),
        ...(params1.headers || {}),
        ...((params2 && params2.headers) || {}),
      },
    };
  }

  protected createAbortSignal = (cancelToken: CancelToken): AbortSignal | undefined => {
    if (this.abortControllers.has(cancelToken)) {
      const abortController = this.abortControllers.get(cancelToken);
      if (abortController) {
        return abortController.signal;
      }
      return void 0;
    }

    const abortController = new AbortController();
    this.abortControllers.set(cancelToken, abortController);
    return abortController.signal;
  };

  public abortRequest = (cancelToken: CancelToken) => {
    const abortController = this.abortControllers.get(cancelToken);

    if (abortController) {
      abortController.abort();
      this.abortControllers.delete(cancelToken);
    }
  };

  public request = async <T = any, E = any>({
    body,
    secure,
    path,
    type,
    query,
    format,
    baseUrl,
    cancelToken,
    ...params
  }: FullRequestParams): Promise<HttpResponse<T, E>> => {
    const secureParams =
      ((typeof secure === "boolean" ? secure : this.baseApiParams.secure) &&
        this.securityWorker &&
        (await this.securityWorker(this.securityData))) ||
      {};
    const requestParams = this.mergeRequestParams(params, secureParams);
    const queryString = query && this.toQueryString(query);
    const payloadFormatter = this.contentFormatters[type || ContentType.Json];
    const responseFormat = format || requestParams.format;

    return this.customFetch(
      `${baseUrl || this.baseUrl || ""}${path}${queryString ? `?${queryString}` : ""}`,
      {
        ...requestParams,
        headers: {
          ...(requestParams.headers || {}),
          ...(type && type !== ContentType.FormData ? { "Content-Type": type } : {}),
        },
        signal: (cancelToken ? this.createAbortSignal(cancelToken) : requestParams.signal) || null,
        body: typeof body === "undefined" || body === null ? null : payloadFormatter(body),
      }
    ).then(async (response) => {
      const r = response as HttpResponse<T, E>;
      r.data = null as unknown as T;
      r.error = null as unknown as E;

      const responseToParse = responseFormat ? response.clone() : response;
      const data = !responseFormat
        ? r
        : await responseToParse[responseFormat]()
            .then((data) => {
              if (r.ok) {
                r.data = data;
              } else {
                r.error = data;
              }
              return r;
            })
            .catch((e) => {
              r.error = e;
              return r;
            });

      if (cancelToken) {
        this.abortControllers.delete(cancelToken);
      }

      if (!response.ok) throw data;
      return data;
    });
  };
}

/**
 * @title FastAPI
 * @version 0.1.0
 */
export class ApiService<SecurityDataType extends unknown> extends HttpClient<SecurityDataType> {
  api = {
    /**
     * No description
     *
     * @tags tasks
     * @name getTaskStatus
     * @summary Get Task Status
     * @request GET:/api/v1/tasks/{task_id}/status
     */
    getTaskStatus: (taskId: string, params: RequestParams = {}) =>
      this.request<TaskStatusResponse, HTTPValidationError>({
        path: `${BASE_URL}/api/v1/tasks/${taskId}/status`,
        method: "GET",
        format: "json",
        ...params,
      }),

    /**
     * No description
     *
     * @tags tasks
     * @name sanitize
     * @summary Sanitize
     * @request POST:/api/v1/tasks/sanitize
     */
    sanitize: ({ file }: SanitizeRequest, params: RequestParams = {}) => {
      const form = new FormData();
      form.append("file", file);

      return this.request<TaskResponse, HTTPValidationError>({
        path: `${BASE_URL}/api/v1/tasks/sanitize`,
        method: "POST",
        body: form,
        type: ContentType.FormData,
        format: "json",
        ...params,
      });
    },

    /**
     * @description Update the content of a PowerPoint presentation slide by applying or reverting specified action to the specified shape.
     *
     * @tags tasks
     * @name UpdateContent
     * @summary Update Content
     * @request POST:/api/v1/tasks/{task_id}/update_content
     */
    updateContent: (
      taskId: string,
      query: {
        change_id: number;
        operation?: Operation;
      },
      data: File,
      params: RequestParams = {}
    ) => {
      const form = new FormData();
      form.append("file", data);

      return this.request<any, HTTPValidationError>({
        path: `${BASE_URL}/api/v1/tasks/${taskId}/update_content`,
        method: "POST",
        query: query,
        body: form,
        type: ContentType.FormData,
        format: "json",
        ...params,
      });
    },

    /**
     * No description
     *
     * @tags changelogs
     * @name GetFinalChangelog
     * @summary Get Final Changelog
     * @request GET:/api/v1/changelogs/{task_id}/status
     */
    getFinalChangelog: (taskId: string, params: RequestParams = {}) =>
      this.request<FinalChangelogResponse, HTTPValidationError>({
        path: `${BASE_URL}/api/v1/changelogs/${taskId}/status`,
        method: "GET",
        format: "json",
        ...params,
      }),

    /**
     * No description
     *
     * @tags changelogs
     * @name updateTaskChangelog
     * @summary Update Task Changelog
     * @request POST:/api/v1/changelogs/{changelog_id}
     */
    updateTaskChangelog: (
      taskId: string,
      data: UpdateChangelogRequest,
      params: RequestParams = {}
    ) =>
      this.request<ChangelogResponse, HTTPValidationError>({
        path: `${BASE_URL}/api/v1/changelogs/${taskId}`,
        method: "POST",
        body: data,
        type: ContentType.Json,
        format: "json",
        ...params,
      }),

    /**
     * No description
     *
     * @tags changelogs
     * @name exportFinalChangelog
     * @summary Export Final Changelog
     * @request GET:/api/v1/changelogs/{changelog_id}/export
     */
    exportFinalChangelog: (taskId: string, params: RequestParams = {}) =>
      this.request<any, HTTPValidationError>({
        path: `${BASE_URL}/api/v1/changelogs/${taskId}/export`,
        method: "GET",
        format: "json",
        ...params,
      }),

    /**
     * No description
     *
     * @tags screenshots
     * @name uploadSlideScreenshot
     * @summary Upload Slide Screenshot
     * @request POST:/api/v1/screenshots/{task_id}/{slide_number}
     */
    uploadSlideScreenshot: (
      taskId: string,
      slideNumber: number,
      data: UploadSlideScreenshotRequest,
      params: RequestParams = {}
    ) => {
      const form = new FormData();
      form.append("file", data.file);

      return this.request<any, HTTPValidationError>({
        path: `${BASE_URL}/api/v1/screenshots/${taskId}/${slideNumber}`,
        method: "POST",
        body: form,
        type: ContentType.FormData,
        format: "json",
        ...params,
      });
    },
    async uploadAllScreenshots(taskId: string, screenshots: File[]) {
      return await Promise.all(
        screenshots.map(async (file, id) => {
          await this.uploadSlideScreenshot(taskId, id, { file });
        })
      );
    },
    /**
     * Uploads a file and polls task status until it is completed.
     *  * Uses existing endpoints: `sanitize({ file })` and `getTaskStatus(taskId)`.
     *  * Preserves original recursive setTimeout polling logic (no while-true).
     *
     * @param file   Presentation File (.pptx)
     * @param screenshots   Screenshots of slides File[] (.png)
     * @param opts   Settings
     */
    async uploadPresentationFile(
      file: File,
      screenshots: File[],
      opts: UploadPresentationFileOptions = {}
    ): Promise<UploadPresentationResponse> {
      const intervalMs = opts.intervalMs ?? 3000;

      const startRes = await this.sanitize({ file });
      const taskId: string = startRes.data.taskId;
      // const taskId: string = "e17c5820-1a46-4d40-9671-af0f470bdd49"; // Lockheed Martin  task new (01)

      await this.uploadAllScreenshots(taskId, screenshots);
      return new Promise<TaskStatusResponse>((resolve, reject) => {
        let pollTimer: number | null = null;

        const cleanup = () => {
          if (pollTimer !== null) {
            clearTimeout(pollTimer);
            pollTimer = null;
          }
          if (opts.signal) {
            opts.signal.removeEventListener("abort", onAbort);
          }
        };

        const onAbort = () => {
          cleanup();
          reject(new DOMException("Aborted", "AbortError"));
        };

        if (opts.signal?.aborted) {
          return onAbort();
        }

        if (opts.signal) {
          opts.signal.addEventListener("abort", onAbort, { once: true });
        }

        const checkStatus = async () => {
          if (opts.signal?.aborted) {
            return onAbort();
          }

          try {
            const statusRes = await this.getTaskStatus(taskId);
            const data: TaskStatusResponse = statusRes.data;
            const status = data?.status;

            if (status === "failed") {
              cleanup();
              return reject(new Error("File processing task failed"));
            }

            if (status === "completed") {
              if (!data?.changelog) {
                cleanup();
                return reject(new Error("Completed without changelog"));
              }

              cleanup();
              return resolve({ changelog: data.changelog, taskId });
            }

            pollTimer = window.setTimeout(checkStatus, intervalMs);
          } catch (err) {
            cleanup();
            reject(err);
          }
        };

        checkStatus();
      });
    },

    /**
     * @description Generate the final PowerPoint presentation without all the metadata.
     *
     * @tags presentations
     * @name RemovePresentationMetadataRequest
     * @summary Remove Presentation Metadata
     * @request POST:/api/v1/presentations/remove_metadata
     */
    removePresentationMetadata: (
      data: RemovePresentationMetadataRequest,
      params: RequestParams = {}
    ) => {
      const form = new FormData();
      form.append("file", data.file);
      return this.request<any, HTTPValidationError>({
        path: `${BASE_URL}/api/v1/presentations/remove_metadata`,
        method: "POST",
        body: form,
        type: ContentType.FormData,
        format: "json",
        ...params,
      });
    },
  };
}
