import GallerySkeleton from "../components/GallerySkeleton";

/** Ce qui s'affiche pendant que l'album remonte de Dropbox. */
export default function Loading() {
  return <GallerySkeleton withTabs count={12} />;
}
