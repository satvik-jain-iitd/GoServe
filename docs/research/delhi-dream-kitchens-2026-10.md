# Delhi dream kitchens, October 2026

**Epic E16, stories #282, #290, #292.** The ten demo kitchens of the dream city. Written under the `web-research` skill, 25 Oct 2026. Updated the same day.

## Read this first

- Every kitchen is **demo**. It carries GoServe's own name. It is *modelled on* a real kind of Delhi place. It is not that place, and no real brand name is used.
- **One menu for all ten kitchens** (owner, 25 Oct): the same 12 dishes, the same prices, the same 12 photos. This replaced the first plan of ten different menus (135 dishes), then 70 dishes, then 14. The web gave place names and a few anchor prices (Tier C) and almost no per-dish prices, so the **prices are our estimates** (confidence 0.4 to 0.5). The two thali prices (Rs 199, Rs 279) are the owner's own, from 25 Oct. Demo only, never a pitch claim.
- Pins and coordinates are the centre of the area, from public knowledge (Tier C, 0.6). The owner's prod SQL gave the Wok House pins 110091 and 110051 (Tier S).
- **Photos: exactly 12 different pictures, one per dish** (owner: photos cost storage, and every dish has one). They come from Openverse, only under CC0, public domain or CC BY (free commercial use, no share-alike). Each was looked at before it was accepted.
- The 40 riders carry names of famous Indians. Names only. No photo, no quote, no link to GoServe.
- The data lives in `app/supabase/migrations/0034`, `0037` and `0038`; the photo records in `scripts/dish_photo_choices.json`. Those files are the single source. This page explains them.

## Ten kitchens

| # | GoServe name | Area | Pins served | Lat, lng | Hours |
|---|---|---|---|---|---|
| 1 | Dilli-6 Kebab Ghar | Jama Masjid | 110006, 110002, 110092 | 28.6507, 77.2334 | 12:00 to 23:00 |
| 2 | Gali Parantha Rasoi | Chandni Chowk | 110006, 110007, 110054, 110092 | 28.6562, 77.23 | 08:00 to 22:00 |
| 3 | Punjab Da Dhaba | Rajouri Garden | 110027, 110018, 110064 | 28.6492, 77.1219 | 11:00 to 23:30 |
| 4 | Madras Tiffin Room | Lajpat Nagar | 110024, 110014, 110049 | 28.5677, 77.2433 | 07:30 to 22:00 |
| 5 | Bhodro Bangali | CR Park | 110019, 110048, 110020 | 28.5384, 77.248 | 11:00 to 22:30 |
| 6 | Tilla Momo House | Majnu ka Tilla | 110054, 110009, 110007 | 28.6995, 77.2285 | 11:00 to 22:00 |
| 7 | Karol Bagh Chaat Corner | Karol Bagh | 110005, 110055, 110060 | 28.6514, 77.1907 | 10:00 to 22:00 |
| 8 | Nizam Dum Biryani | Nizamuddin | 110013, 110003, 110014, 110092 | 28.5886, 77.2509 | 12:00 to 23:30 |
| 9 | Thali Ghar CP | Connaught Place | 110001, 110002, 110055, 110092 | 28.6315, 77.2167 | 11:30 to 22:30 |
| 11 | Laxmi Nagar Wok House | Laxmi Nagar | 110092, 110091, 110051 | 28.6304, 77.2773 | 11:00 to 23:00 |

Kitchens 1 to 9 are modelled on the Delhi food kinds of the first version of this file (Old Delhi kebabs, paranthas, a Punjabi dhaba, South Indian tiffin, Bengali, momos, chaat, biryani, a thali house). Number 11 is Laxmi Nagar Wok House (Indo-Chinese, East Delhi). Number 10, Green Bowl Co, was dropped on 25 Oct (owner: exactly ten kitchens); its ids stay unused. Pin 110092 (the owner's test pin) is served by five kitchens (1, 2, 8, 9 and 11).

## The one menu

| # | Dish | Category | Veg | Price (Rs) |
|---|---|---|---|---|
| 1 | Butter Chicken | Mains | non-veg | 340 |
| 3 | Dal Makhani | Mains | veg | 240 |
| 4 | Chole Bhature | Mains | veg | 130 |
| 5 | Amritsari Kulcha | Breads | veg | 90 |
| 6 | Veg Fried Rice | Rice | veg | 150 |
| 7 | Samosa (2) | Snacks | veg | 40 |
| 8 | Gulab Jamun (2) | Sweets | veg | 60 |
| 9 | Masala Chai | Drinks | veg | 30 |
| 10 | Sweet Lassi | Drinks | veg | 80 |
| 11 | Aloo Parantha | Breads | veg | 70 |
| 13 | Veg Thali | Thali | veg | 199 |
| 14 | Non-veg Thali | Thali | non-veg | 279 |

## Photo sources (the photographer's own page, licence from Openverse)

| Dish | Title | Creator | Licence | Source page | Openverse id |
|---|---|---|---|---|---|
| Butter Chicken | Mango Shiva - Butter Chicken with Honey Coconut Naan | elsie.hui | BY 2.0 | https://www.flickr.com/photos/91188380@N05/11200970036 | b9a0e3b0-08e7-4c2e-b796-ac27b5f30c82 |
| Dal Makhani | Indian Food Dal Makhani | MyStockPhotos | CC0 1.0 | https://www.flickr.com/photos/136375272@N05/40300293643 | bf5e31b5-2305-4905-954a-b87e48278c54 |
| Chole Bhature | That's The Chole Bhature Ka Plate | gagandeepsapra | BY 2.0 | https://www.flickr.com/photos/17983554@N00/5270482725 | 642fea6c-6941-4870-b67b-f5bf8ae54609 |
| Amritsari Kulcha | Amritsari Kulche | प्रतीक | BY 2.0 | https://www.flickr.com/photos/58196392@N00/6312710807 | 1d919521-6891-4780-aa7a-b0c417771b2f |
| Veg Fried Rice | Veg fried rice at a Nepali Restaurant, Kathmandu, Nepal | Mehraz Morshed | CC0 1.0 | https://wordpress.org/photos/photo/2706a2adbd/ | fff15beb-a5a2-47a8-b59b-bc9167f852fe |
| Samosa (2) | samosa di verdure | cristina.sanvito | BY 2.0 | https://www.flickr.com/photos/40385177@N07/9316387431 | 144c7994-6e59-4902-9654-70d24b535e38 |
| Gulab Jamun (2) | gulab jamun (1) | Joelk75 | BY 2.0 | https://www.flickr.com/photos/75001512@N00/4120363611 | 4687c81e-2ffb-4a1c-a764-58d8e88ebe7d |
| Masala Chai | Masala Chai Tea | elsie.hui | BY 2.0 | http://www.flickr.com/photos/91188380@N05/16635237970 | 27082df1-925d-4199-924e-307b50936e4e |
| Sweet Lassi | Lassi, Fat free yogurt shake | Swami Stream | BY 2.0 | https://www.flickr.com/photos/21063397@N00/440401976 | 1e130ca3-0184-4840-8661-7b29d1bb1152 |
| Aloo Parantha | Aloo parantha and dahi for breakfast | rosemilkinabottle | BY 2.0 | https://www.flickr.com/photos/66606504@N00/4364825054 | 7ea3dc97-db19-468b-8594-44b7715ac834 |
| Veg Thali | Veg Thali in Kochi | Saaheel Majethia | CC0 1.0 | https://wordpress.org/photos/photo/22864218d0/ | 7852d3f6-5536-4306-81e6-cfe373622555 |
| Non-veg Thali | A metal plate holds a Varhadi Chicken Thali with tandoori roti, spicy  | Pritam Sonone | CC0 1.0 | https://wordpress.org/photos/photo/616a002419/ | f4aa8ab4-6696-41c5-a7c0-dec8b162763c |

Licence check: Openverse lists the licence of each file and links the creator's page. CC BY 2.0 and CC0 1.0 are Creative Commons licences (creativecommons.org), free for commercial use. CC BY needs the title, creator and licence named; the dish sheet does that and links the licence name. Looked at by eye on 25 Oct 2026: the Butter Chicken photo is butter chicken with naan; the Veg Fried Rice photo is a plate from a Nepali restaurant; the Veg Thali is a banana-leaf spread from Kochi and the Non-veg Thali a chicken curry thali from Vidarbha.

## Dropped

- Green Bowl Co (number 10, healthy bowls, Hauz Khas): dropped 25 Oct, owner decision.
- The first menus (135 dishes, then 70, then 14 with Chicken Tikka and Paneer Tikka Masala): replaced by the one menu above on 25 Oct. Migration 0038 deletes their dish rows; the research that found them is in the git history of this file.

## Pin drop points

Used by `pin_points`. The centre of each area; an order drops within a few hundred metres of it.

| Pin | Lat | Lng |
|---|---|---|
| 110001 | 28.6315 | 77.2167 |
| 110002 | 28.642 | 77.24 |
| 110003 | 28.59 | 77.225 |
| 110005 | 28.6514 | 77.1907 |
| 110006 | 28.656 | 77.229 |
| 110007 | 28.68 | 77.2 |
| 110009 | 28.695 | 77.21 |
| 110013 | 28.5886 | 77.2509 |
| 110014 | 28.57 | 77.25 |
| 110016 | 28.5494 | 77.2001 |
| 110017 | 28.528 | 77.215 |
| 110018 | 28.64 | 77.1 |
| 110019 | 28.5384 | 77.248 |
| 110020 | 28.52 | 77.27 |
| 110024 | 28.5677 | 77.2433 |
| 110027 | 28.6492 | 77.1219 |
| 110029 | 28.566 | 77.21 |
| 110048 | 28.545 | 77.24 |
| 110049 | 28.56 | 77.23 |
| 110051 | 28.656 | 77.28 |
| 110054 | 28.685 | 77.228 |
| 110055 | 28.645 | 77.21 |
| 110060 | 28.64 | 77.17 |
| 110064 | 28.66 | 77.1 |
| 110091 | 28.604 | 77.297 |
| 110092 | 28.635 | 77.295 |

## What would change a number here

- A real kitchen signs: replace that kitchen's menu with its own and its own prices.
- A Swiggy or Zomato export for a pin: Tier B, lifts the confidence of a price to about 0.7.
- The owner's own pilot data (Tier S) beats everything above.
