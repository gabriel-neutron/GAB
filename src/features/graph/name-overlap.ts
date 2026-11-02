export interface NameBox {
  readonly x: number;
  readonly y: number;
  readonly width: number;
  readonly height: number;
}

const meet = (one: NameBox, two: NameBox): boolean =>
  one.x < two.x + two.width &&
  two.x < one.x + one.width &&
  one.y < two.y + two.height &&
  two.y < one.y + one.height;

/** Which boxes stay drawn. The boxes come in order of rank: a box that meets a kept box of a
 * higher rank is dropped, so the selection and the strongest neighbours keep their names. */
export function keptNames(boxes: readonly (NameBox | null)[]): boolean[] {
  const kept: NameBox[] = [];
  return boxes.map((box) => {
    if (box === null || kept.some((other) => meet(box, other))) return false;
    kept.push(box);
    return true;
  });
}
