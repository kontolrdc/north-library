'use client';

import { FormEvent, useState } from 'react';

export default function AdminStoryUpload({ onUploaded }: { onUploaded: () => void }) {
  const [status, setStatus] = useState('');
  const [busy, setBusy] = useState(false);

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const form = event.currentTarget;
    const data = new FormData(form);
    setBusy(true);
    setStatus('Extracting PDF pages...');

    try {
      const response = await fetch('/api/admin/stories/upload', {
        method: 'POST',
        credentials: 'include',
        body: data,
      });
      const result = await response.json();

      if (!response.ok) {
        setStatus(result.error ?? 'Unable to upload this book.');
        return;
      }

      setStatus(`Uploaded ${result.pageCount} reader pages. The table of contents and introduction are free.`);
      form.reset();
      onUploaded();
    } catch {
      setStatus('Upload failed. Check your connection and try again.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <section className="card admin-upload-card p-4">
      <p className="text-uppercase text-muted small mb-2">PDF ingestion</p>
      <h2 className="h4 mb-2">Upload a story</h2>
      <p className="text-muted small mb-4">The table of contents and introduction are free. Each following text page costs GHS 1 to unlock. Selectable-text PDFs up to 4 MB are supported.</p>
      <form className="admin-upload-form" onSubmit={submit}>
        <label htmlFor="upload-pdf">PDF file</label>
        <input id="upload-pdf" name="file" type="file" accept="application/pdf,.pdf" required />

        <label htmlFor="upload-title">Book title</label>
        <input id="upload-title" name="title" required defaultValue="A Critical Introduction to Shakespeare" />

        <label htmlFor="upload-author">Author</label>
        <input id="upload-author" name="author" defaultValue="H. N. MacCracken, F. E. Pierce, and W. H. Durham" />

        <label htmlFor="upload-category">Category</label>
        <input id="upload-category" name="category" defaultValue="Literature" required />

        <label htmlFor="upload-summary">Short description</label>
        <textarea id="upload-summary" name="summary" rows={3} defaultValue="An introduction to Shakespeare's life, drama, and plays." />

        <label htmlFor="upload-introduction">Free introduction</label>
        <textarea id="upload-introduction" name="introduction" rows={5} required defaultValue="This guide introduces Shakespeare through the surviving records of his life, the English drama before him, and the Elizabethan theater. Begin with the Stratford years; later chapters follow his development as a playwright. The contents and this introduction are free." />

        <button type="submit" className="btn btn-primary" disabled={busy}>{busy ? 'Processing...' : 'Upload and publish'}</button>
        {status && <p className="admin-upload-status mb-0" role="status">{status}</p>}
      </form>
    </section>
  );
}
