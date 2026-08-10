import GallerySkeleton from "../../components/GallerySkeleton";

/** Ce qui s'affiche entre le clic sur un invité et l'arrivée de ses photos. */
export default function Loading() {
  return <GallerySkeleton count={9} />;
}
