// The share of the way that the nodes have gone from their old place to their new one, from 0 to 1.
// The node and edge programs read it on each draw, so the move runs on the graphics card and a
// frame of it costs no more than a frame of a pan.
export const morph = { progress: 1 };
