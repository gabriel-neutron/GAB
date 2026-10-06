export interface put_fetched_document_params {
  p_kind: string;

  p_title: string;

  p_s3_key: string;

  p_uri: string;

  p_sha256: string;

  p_mime: string;

  p_retrieved_at: Date;

  p_archive_uri?: string;

  p_provider_id?: string;
}
