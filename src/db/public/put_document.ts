export interface put_document_params {
  p_id: string;

  p_kind: string;

  p_title: string;

  p_s3_key?: string;

  p_uri?: string;

  p_archive_uri?: string;

  p_sha256?: string;

  p_mime?: string;

  p_retrieved_at?: Date;
}
