import { defineCollection, z } from 'astro:content';
import { glob } from 'astro/loaders';

const spirits = defineCollection({
  loader: glob({ pattern: '**/*.json', base: './src/content/spirits' }),
  schema: z.object({
    title: z.string(),
    range: z.enum(['klahn', 'black-squid']),
    style: z.string().optional(),
    price: z.number(),
    salePrice: z.number().nullable().optional(),
    abv: z.string().optional(),
    volume: z.string().optional(),
    soldOut: z.boolean().default(false),
    featured: z.boolean().default(false),
    hidden: z.boolean().default(false), // buyable via direct URL, but never listed
    components: z.array(z.string()).default([]), // bundle: slugs of included spirits (empty = normal product)
    order: z.number().default(99),
    description: z.string(),
    serve: z.string().optional(),
    images: z.array(z.string()).default([]),
  }),
});

const bottles = defineCollection({
  loader: glob({ pattern: '**/*.json', base: './src/content/bottles' }),
  schema: z.object({
    title: z.string(),
    category: z.enum(['bottle', 'closure']),
    price: z.number(),
    priceFrom: z.boolean().default(false),
    note: z.string().optional(),
    order: z.number().default(99),
    image: z.string().optional(),
  }),
});

const journal = defineCollection({
  loader: glob({ pattern: '**/*.md', base: './src/content/journal' }),
  schema: z.object({
    title: z.string(),
    date: z.coerce.date(),
    excerpt: z.string().optional(),
    cover: z.string().optional(),
  }),
});

export const collections = { spirits, bottles, journal };
