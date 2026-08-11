import { useParams } from '@tanstack/react-router';

export function DetailPage() {
  // The identifier is the only thing known about the entity until the read layer exists
  // (#26), and a heading that says "Entity" on every entity names nothing.
  const { id } = useParams({ from: '/entity/$id' });

  return <h1>Entity {id}</h1>;
}
