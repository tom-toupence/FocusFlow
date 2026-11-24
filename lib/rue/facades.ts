// Les façades de « Ta rue » (photo + fenêtres annotées à la main).
// Source : public/rues-amis/<id>/windows.json, photo.webp et photo-1200.webp.
import facadeJson from "@/public/rues-amis/facade/windows.json";
import type { Facade } from "@/lib/rue/friendStreet";

export const FACADES: Facade[] = [facadeJson as unknown as Facade];

export const facadePhoto = (id: string, small = false) => `/rues-amis/${id}/${small ? "photo-1200" : "photo"}.webp`;
