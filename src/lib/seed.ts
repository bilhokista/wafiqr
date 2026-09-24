// Demo catalog. Shown when Firestore is empty or unreachable so the marketplace
// always has goods on the shelf during a walkthrough.
import type { Listing } from './types';

const DEMO_WALLET = 'GB3Q6QDZYTHWT7E5PVS3W7FUT5GVAFC5KSZFFLPU25GO7VTC3NM2ZTVO';

export const SEED_LISTINGS: Listing[] = [
  {
    id: 'seed-nutmeg-oil',
    sellerUid: 'seed-rempah',
    sellerName: 'Rempah Nusantara',
    sellerVillage: 'Sari Wangi, Bogor',
    sellerWallet: DEMO_WALLET,
    title: 'Pure Nutmeg Essential Oil',
    origin: 'Banda Islands, Maluku',
    category: 'spice',
    unit: 'L',
    minOrder: 5,
    pricePerUnit: 2,
    leadTimeDays: 10,
    incoterm: 'CIF',
    specs: 'GC-MS report included · myristicin 8–11% · steam distilled, 2025 harvest',
    description:
      'Distilled in small copper stills within a day of the harvest, so the oil keeps the warm, sweet top note that bulk lots lose in transit.',
    // No photo until a real one is sourced: the previous stock URL rendered a
    // handbag, and a wrong picture on a trust product is worse than none.
    imageUrl: '',
    active: true,
    createdAt: Date.now() - 86400000 * 3,
  },
  {
    id: 'seed-gayo-arabica',
    sellerUid: 'seed-gayo',
    sellerName: 'Koperasi Kopi Gayo',
    sellerVillage: 'Takengon, Aceh',
    sellerWallet: DEMO_WALLET,
    title: 'Gayo Arabica — Wet Hulled, Grade 1',
    origin: 'Takengon, Aceh',
    category: 'coffee',
    unit: 'kg',
    minOrder: 30,
    pricePerUnit: 9,
    leadTimeDays: 14,
    incoterm: 'FOB',
    specs: 'Screen 16+ · moisture 12% · cupping score 84.5 · defect count under 5 per 300 g',
    description:
      'A cooperative of 40 smallholders above 1,400 m. Each lot carries the cupping sheet and the name of the farm block it came from.',
    imageUrl:
      'https://images.unsplash.com/photo-1447933601403-0c6688de566e?auto=format&fit=crop&w=1200&q=70',
    active: true,
    createdAt: Date.now() - 86400000 * 5,
  },
  {
    id: 'seed-rattan-basket',
    sellerUid: 'seed-rotan',
    sellerName: 'Rotan Cirebon',
    sellerVillage: 'Plumbon, Cirebon',
    sellerWallet: DEMO_WALLET,
    title: 'Hand-woven Rattan Basket Set',
    origin: 'Plumbon, Cirebon',
    category: 'craft',
    unit: 'set',
    minOrder: 20,
    pricePerUnit: 14,
    leadTimeDays: 21,
    incoterm: 'EXW',
    specs: 'Three nested sizes · kiln-dried core rattan · natural finish, no lacquer',
    description:
      'Woven by six families who have shaped the same core rattan for three generations. Each set is signed on the base.',
    imageUrl:
      'https://images.unsplash.com/photo-1519710164239-da123dc03ef4?auto=format&fit=crop&w=1200&q=70',
    active: true,
    createdAt: Date.now() - 86400000 * 8,
  },
  {
    id: 'seed-tenun-ikat',
    sellerUid: 'seed-tenun',
    sellerName: 'Tenun Sumba Timur',
    sellerVillage: 'Waingapu, Sumba',
    sellerWallet: DEMO_WALLET,
    title: 'Natural-dye Ikat Panel',
    origin: 'Waingapu, East Sumba',
    category: 'textile',
    unit: 'pcs',
    minOrder: 4,
    pricePerUnit: 120,
    leadTimeDays: 45,
    incoterm: 'DDP',
    specs: 'Handspun cotton · indigo and morinda root dye · 240 × 90 cm · eight-month weave',
    description:
      'One panel takes a weaver most of a year, from spinning the cotton to the last row of the pattern her grandmother set.',
    imageUrl:
      'https://images.unsplash.com/photo-1528458965990-428de4b1cb0d?auto=format&fit=crop&w=1200&q=70',
    active: true,
    createdAt: Date.now() - 86400000 * 12,
  },
  {
    id: 'seed-cassia',
    sellerUid: 'seed-kayu-manis',
    sellerName: 'Kayu Manis Kerinci',
    sellerVillage: 'Sungai Penuh, Jambi',
    sellerWallet: DEMO_WALLET,
    title: 'Korintji Cassia Bark — AA Grade',
    origin: 'Kerinci, Jambi',
    category: 'spice',
    unit: 'kg',
    minOrder: 50,
    pricePerUnit: 4.5,
    leadTimeDays: 12,
    incoterm: 'FOB',
    specs: 'Volatile oil 2.5% min · moisture 13% max · sun-dried quills, hand sorted',
    description:
      'Bark peeled from trees at least eight years old, which is where the sweetness and the oil content come from.',
    imageUrl:
      'https://images.unsplash.com/photo-1587049352846-4a222e784d38?auto=format&fit=crop&w=1200&q=70',
    active: true,
    createdAt: Date.now() - 86400000 * 15,
  },
];

export const seedById = (id: string) => SEED_LISTINGS.find((l) => l.id === id) ?? null;
