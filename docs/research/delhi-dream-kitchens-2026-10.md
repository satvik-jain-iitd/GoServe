# Delhi dream kitchens, October 2026

**Story #282, epic E16.** The ten demo kitchens in the dream city. Written under the `web-research` skill, 25 Oct 2026.

## Read this first

- Every kitchen is **demo**. It carries GoServe's own name. It is *modelled on* a real kind of Delhi place. It is not that place, and no real brand name is used.
- **Menus and prices are estimates.** The web gave place names, areas and a few anchor prices (Tier C). It gave almost no per-dish prices. Each price below is our estimate for a delivery menu in 2026, anchored on the sources in the table. Confidence **0.4 to 0.5**. Good enough for a demo. Never a pitch claim.
- Pins and coordinates are the centre of the area, from public knowledge (Tier C, 0.6). Dish prices are a range of about plus or minus 25 percent, not a quote.
- The 40 riders carry names of famous Indians (sport, film, music, science). Names only. No photo, no quote, no claim that the person has any link to GoServe.
- The data lives in `app/supabase/migrations/0034_dream_city.sql`. That file is the single source. This page explains it.

## Ten kitchens

| # | GoServe name | Modelled on | Area | Pins served | Lat, lng | Hours | Dishes |
|---|---|---|---|---|---|---|---|
| 1 | Dilli-6 Kebab Ghar | Karim's, Gali Kababian (Old Delhi Mughlai) | Jama Masjid | 110006, 110002, 110092 | 28.6507, 77.2334 | 12:00 to 23:00 | 14 |
| 2 | Gali Parantha Rasoi | the shops of Paranthe Wali Gali | Chandni Chowk | 110006, 110007, 110054, 110092 | 28.6562, 77.23 | 08:00 to 22:00 | 14 |
| 3 | Punjab Da Dhaba | the Punjabi dhabas of Rajouri Garden | Rajouri Garden | 110027, 110018, 110064 | 28.6492, 77.1219 | 11:00 to 23:30 | 14 |
| 4 | Madras Tiffin Room | the South Indian tiffin rooms of Lajpat Nagar | Lajpat Nagar | 110024, 110014, 110049 | 28.5677, 77.2433 | 07:30 to 22:00 | 14 |
| 5 | Bhodro Bangali | the Bengali kitchens of CR Park Market 1 | CR Park | 110019, 110048, 110020 | 28.5384, 77.248 | 11:00 to 22:30 | 14 |
| 6 | Tilla Momo House | the momo and thukpa shops of Majnu ka Tilla | Majnu ka Tilla | 110054, 110009, 110007 | 28.6995, 77.2285 | 11:00 to 22:00 | 14 |
| 7 | Karol Bagh Chaat Corner | the chaat and mithai shops of Karol Bagh | Karol Bagh | 110005, 110055, 110060 | 28.6514, 77.1907 | 10:00 to 22:00 | 14 |
| 8 | Nizam Dum Biryani | the biryani and kebab lanes of Nizamuddin | Nizamuddin | 110013, 110003, 110014, 110092 | 28.5886, 77.2509 | 12:00 to 23:30 | 13 |
| 9 | Thali Ghar CP | the thali houses around Connaught Place | Connaught Place | 110001, 110002, 110055, 110092 | 28.6315, 77.2167 | 11:30 to 22:30 | 12 |
| 10 | Green Bowl Co | the healthy bowl cloud kitchens of Hauz Khas and Saket | Hauz Khas | 110016, 110017, 110029 | 28.5494, 77.2001 | 08:00 to 22:00 | 14 |

Total: 137 dishes. Pin 110092 (the owner's test pin) is served by four kitchens.

## Sources and confidence, per kitchen

| # | What the web said | Tier | Confidence | Date |
|---|---|---|---|---|
| 1 | Karim's Gurgaon branch review (indianfoodfreak.com, undated): mutton burra Rs 440, seekh kebab Rs 245, nihari Rs 320. Delhi Food Walks guide (blog.delhifoodwalks.com, undated): seekh recommended, about Rs 850 for two. Tier C. | C | 0.4 | 2026-10-25 |
| 2 | Wikipedia, Gali Paranthe Wali (Tier C, encyclopedia). Explurger and a travel blog: Rs 100 to 200 per person, fillings aloo, gobhi, mattar, paneer. No per-dish price found. Tier C. | C | 0.4 | 2026-10-25 |
| 3 | EazyDiner listings for Rajouri Garden dhabas (Tier C): about Rs 1,500 to 1,800 for two, dal makhani and butter chicken named. No dish price found. Tier C. | C | 0.4 | 2026-10-25 |
| 4 | EazyDiner, Southy Lajpat Nagar (Tier C): about Rs 400 to 450 for two. No dish price found. Tier C. | C | 0.4 | 2026-10-25 |
| 5 | chittaranjanpark.com guide, June 2026 (Tier C, local guide): Mutton Kosha Rs 180 to 220 a plate at one shop, Luchi Rs 20 each, fish thali Rs 180 to 220, Bhetki Paturi Rs 120 to 150. Raised for delivery. Tier C. | C | 0.4 | 2026-10-25 |
| 6 | The Delhi Walla, 2009 (Tier C, old): Dolma House veg momos Rs 35, Tibetan sausage Rs 55. Wanderlog and Outlook Traveller: Tee Dee, Tenzin Dorje, Ama named. 2009 prices not used. Tier C. | C | 0.4 | 2026-10-25 |
| 7 | Swiggy listing, Bikaner Sweets Karol Bagh (Tier C, a seller): Kaju Burfi Rs 337, Jodhpuri Ladoo Rs 127; about Rs 400 for two. Delhi Tourism lists Karol Bagh as a street-food area (Tier A, for that fact only). | C | 0.4 | 2026-10-25 |
| 8 | magicpin, Behrouz price list 2024 (Tier C, a seller): chicken dum biryani Rs 329, dum gosht Rs 349 (regular). Majeed's about Rs 450 for two. No Nizamuddin menu found. | C | 0.4 | 2026-10-25 |
| 9 | CRISIL Roti Rice Rate, July 2026 (Tier B): a home-cooked veg thali costs about Rs 30 to 35, so a restaurant thali price is not derivable from it. No Connaught Place menu found. Price is our estimate. | C | 0.4 | 2026-10-25 |
| 10 | OT Eats, Salad Life (Tier C, August 2025): salads, rice bowls, smoothie bowls, wraps, cold-pressed juice. No price. Our estimate. | C | 0.4 | 2026-10-25 |

Motive check: every source above earns from listings, ads or bookings, so a price in it leans high or is a show price. We kept the estimate low-to-middle. Tier A for the place facts (Delhi Tourism) proves the area is a food area, not any price.

## 1. Dilli-6 Kebab Ghar

Modelled on Karim's, Gali Kababian (Old Delhi Mughlai). Near Jama Masjid, Old Delhi. Hours 12:00 to 23:00. Pins 110006, 110002, 110092.

| Dish | Category | Veg | Price (Rs) |
|---|---|---|---|
| Mutton Seekh Kebab | Kebabs | non-veg | 260 |
| Mutton Burra | Kebabs | non-veg | 450 |
| Chicken Tikka | Kebabs | non-veg | 300 |
| Chicken Seekh Kebab | Kebabs | non-veg | 240 |
| Paneer Tikka | Kebabs | veg | 260 |
| Mutton Korma | Curries | non-veg | 380 |
| Mutton Nihari | Curries | non-veg | 330 |
| Butter Chicken | Curries | non-veg | 320 |
| Chicken Changezi | Curries | non-veg | 340 |
| Mutton Biryani | Rice | non-veg | 380 |
| Sheermal | Breads | veg | 40 |
| Roomali Roti | Breads | veg | 20 |
| Tandoori Roti | Breads | veg | 15 |
| Phirni | Sweets | veg | 80 |

## 2. Gali Parantha Rasoi

Modelled on the shops of Paranthe Wali Gali. Chandni Chowk, Old Delhi. Hours 08:00 to 22:00. Pins 110006, 110007, 110054, 110092.

| Dish | Category | Veg | Price (Rs) |
|---|---|---|---|
| Aloo Parantha | Paranthas | veg | 70 |
| Gobhi Parantha | Paranthas | veg | 80 |
| Mattar Parantha | Paranthas | veg | 80 |
| Paneer Parantha | Paranthas | veg | 100 |
| Mooli Parantha | Paranthas | veg | 75 |
| Mixed Veg Parantha | Paranthas | veg | 90 |
| Lachha Parantha | Paranthas | veg | 60 |
| Rabri Parantha | Sweets | veg | 90 |
| Parantha Thali (2 paranthas, sabzi, chutney, pickle) | Thali | veg | 160 |
| Aloo Sabzi | Sides | veg | 60 |
| Dahi | Sides | veg | 40 |
| Sweet Lassi | Drinks | veg | 70 |
| Masala Chai | Drinks | veg | 30 |
| Gajar Halwa | Sweets | veg | 90 |

## 3. Punjab Da Dhaba

Modelled on the Punjabi dhabas of Rajouri Garden. Rajouri Garden, West Delhi. Hours 11:00 to 23:30. Pins 110027, 110018, 110064.

| Dish | Category | Veg | Price (Rs) |
|---|---|---|---|
| Dal Makhani | Mains | veg | 240 |
| Paneer Butter Masala | Mains | veg | 280 |
| Butter Chicken | Mains | non-veg | 340 |
| Chicken Curry | Mains | non-veg | 300 |
| Sarson Ka Saag | Mains | veg | 220 |
| Makki Ki Roti | Breads | veg | 50 |
| Butter Naan | Breads | veg | 55 |
| Tandoori Roti | Breads | veg | 20 |
| Lachha Parantha | Breads | veg | 50 |
| Amritsari Kulcha | Breads | veg | 90 |
| Jeera Rice | Rice | veg | 140 |
| Boondi Raita | Sides | veg | 70 |
| Punjabi Lassi | Drinks | veg | 90 |
| Dhaba Thali | Thali | veg | 280 |

## 4. Madras Tiffin Room

Modelled on the South Indian tiffin rooms of Lajpat Nagar. Lajpat Nagar, South Delhi. Hours 07:30 to 22:00. Pins 110024, 110014, 110049.

| Dish | Category | Veg | Price (Rs) |
|---|---|---|---|
| Idli Sambar (2) | Tiffin | veg | 90 |
| Medu Vada (2) | Tiffin | veg | 100 |
| Plain Dosa | Dosa | veg | 110 |
| Masala Dosa | Dosa | veg | 140 |
| Rava Dosa | Dosa | veg | 150 |
| Mysore Masala Dosa | Dosa | veg | 160 |
| Onion Uttapam | Dosa | veg | 130 |
| Ven Pongal | Tiffin | veg | 120 |
| Rava Upma | Tiffin | veg | 100 |
| Curd Rice | Rice | veg | 120 |
| Lemon Rice | Rice | veg | 120 |
| Filter Coffee | Drinks | veg | 60 |
| Payasam | Sweets | veg | 90 |
| South Indian Thali | Thali | veg | 260 |

## 5. Bhodro Bangali

Modelled on the Bengali kitchens of CR Park Market 1. Chittaranjan Park, South Delhi. Hours 11:00 to 22:30. Pins 110019, 110048, 110020.

| Dish | Category | Veg | Price (Rs) |
|---|---|---|---|
| Kosha Mangsho | Mains | non-veg | 300 |
| Macher Jhol | Mains | non-veg | 260 |
| Bhetki Paturi | Mains | non-veg | 380 |
| Chingri Malai Curry | Mains | non-veg | 420 |
| Egg Roll | Rolls | non-veg | 90 |
| Chicken Kathi Roll | Rolls | non-veg | 130 |
| Luchi (4) | Breads | veg | 80 |
| Aloo Dum | Mains | veg | 130 |
| Basanti Pulao | Rice | veg | 160 |
| Bengali Fish Thali | Thali | non-veg | 280 |
| Bengali Veg Thali | Thali | veg | 220 |
| Mishti Doi | Sweets | veg | 80 |
| Rasgulla (2) | Sweets | veg | 70 |
| Sandesh (2) | Sweets | veg | 90 |

## 6. Tilla Momo House

Modelled on the momo and thukpa shops of Majnu ka Tilla. Majnu ka Tilla, North Delhi. Hours 11:00 to 22:00. Pins 110054, 110009, 110007.

| Dish | Category | Veg | Price (Rs) |
|---|---|---|---|
| Veg Steamed Momos (8) | Momos | veg | 120 |
| Chicken Steamed Momos (8) | Momos | non-veg | 150 |
| Chicken Fried Momos (8) | Momos | non-veg | 170 |
| Paneer Momos (8) | Momos | veg | 140 |
| Chicken Pan-fried Momos (8) | Momos | non-veg | 170 |
| Veg Thukpa | Soups | veg | 150 |
| Chicken Thukpa | Soups | non-veg | 190 |
| Chicken Thenthuk | Soups | non-veg | 200 |
| Tingmo (2) | Breads | veg | 60 |
| Chicken Shaphale | Snacks | non-veg | 140 |
| Laphing | Snacks | veg | 100 |
| Chilli Chicken Dry | Mains | non-veg | 260 |
| Veg Fried Rice | Rice | veg | 160 |
| Tibetan Butter Tea | Drinks | veg | 70 |

## 7. Karol Bagh Chaat Corner

Modelled on the chaat and mithai shops of Karol Bagh. Karol Bagh, Central Delhi. Hours 10:00 to 22:00. Pins 110005, 110055, 110060.

| Dish | Category | Veg | Price (Rs) |
|---|---|---|---|
| Aloo Tikki Chaat | Chaat | veg | 90 |
| Raj Kachori | Chaat | veg | 110 |
| Dahi Bhalla | Chaat | veg | 90 |
| Papdi Chaat | Chaat | veg | 90 |
| Golgappa (6) | Chaat | veg | 60 |
| Chole Bhature | Mains | veg | 130 |
| Samosa (2) | Snacks | veg | 40 |
| Kachori Sabzi | Snacks | veg | 70 |
| Jalebi (250 g) | Sweets | veg | 100 |
| Gulab Jamun (2) | Sweets | veg | 60 |
| Kaju Katli (250 g) | Sweets | veg | 340 |
| Rasmalai (2) | Sweets | veg | 110 |
| Kulfi Falooda | Sweets | veg | 130 |
| Sweet Lassi | Drinks | veg | 80 |

## 8. Nizam Dum Biryani

Modelled on the biryani and kebab lanes of Nizamuddin. Nizamuddin, South-Central Delhi. Hours 12:00 to 23:30. Pins 110013, 110003, 110014, 110092.

| Dish | Category | Veg | Price (Rs) |
|---|---|---|---|
| Chicken Dum Biryani | Biryani | non-veg | 320 |
| Mutton Dum Biryani | Biryani | non-veg | 380 |
| Veg Dum Biryani | Biryani | veg | 240 |
| Egg Biryani | Biryani | non-veg | 260 |
| Chicken 65 | Starters | non-veg | 220 |
| Seekh Kebab | Starters | non-veg | 240 |
| Chicken Korma | Curries | non-veg | 280 |
| Mutton Korma | Curries | non-veg | 340 |
| Mirchi Ka Salan | Sides | veg | 120 |
| Boondi Raita | Sides | veg | 50 |
| Sheermal | Breads | veg | 50 |
| Double Ka Meetha | Sweets | veg | 110 |
| Phirni | Sweets | veg | 90 |

## 9. Thali Ghar CP

Modelled on the thali houses around Connaught Place. Connaught Place, Central Delhi. Hours 11:30 to 22:30. Pins 110001, 110002, 110055, 110092.

| Dish | Category | Veg | Price (Rs) |
|---|---|---|---|
| Veg Thali | Thali | veg | 320 |
| Deluxe Veg Thali | Thali | veg | 420 |
| Non-veg Thali | Thali | non-veg | 460 |
| Mini Thali | Thali | veg | 220 |
| Rajma Chawal | Mains | veg | 180 |
| Chole Bhature | Mains | veg | 190 |
| Kadhi Chawal | Mains | veg | 170 |
| Dal Tadka Rice | Mains | veg | 170 |
| Paneer Lababdar | Mains | veg | 300 |
| Butter Naan | Breads | veg | 60 |
| Gulab Jamun (2) | Sweets | veg | 80 |
| Chaas | Drinks | veg | 60 |

## 10. Green Bowl Co

Modelled on the healthy bowl cloud kitchens of Hauz Khas and Saket. Hauz Khas, South Delhi. Hours 08:00 to 22:00. Pins 110016, 110017, 110029.

| Dish | Category | Veg | Price (Rs) |
|---|---|---|---|
| Quinoa Power Bowl | Bowls | veg | 320 |
| Grilled Chicken Rice Bowl | Bowls | non-veg | 340 |
| Paneer Tikka Bowl | Bowls | veg | 310 |
| Burrito Bowl | Bowls | veg | 330 |
| Falafel Hummus Salad | Salads | veg | 290 |
| Caesar Salad | Salads | non-veg | 280 |
| Greek Salad | Salads | veg | 270 |
| Smoothie Bowl | Bowls | veg | 350 |
| Oats and Berry Bowl | Bowls | veg | 260 |
| Avocado Toast | Light bites | veg | 280 |
| Cold-pressed Orange Juice | Drinks | veg | 170 |
| Green Detox Juice | Drinks | veg | 190 |
| Protein Shake | Drinks | veg | 240 |
| Millet Khichdi Bowl | Bowls | veg | 250 |

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
| 110054 | 28.685 | 77.228 |
| 110055 | 28.645 | 77.21 |
| 110060 | 28.64 | 77.17 |
| 110064 | 28.66 | 77.1 |
| 110092 | 28.635 | 77.295 |

## Riders

Forty, four per kitchen to start, each near its kitchen. Sachin Tendulkar, Virat Kohli, Kapil Dev, MS Dhoni, Sunil Gavaskar, Rahul Dravid, Sourav Ganguly, Mithali Raj, PV Sindhu, Mary Kom, Neeraj Chopra, Milkha Singh, Dhyan Chand, Abhinav Bindra, Saina Nehwal, Vishwanathan Anand, APJ Abdul Kalam, CV Raman, Homi Bhabha, Vikram Sarabhai, Srinivasa Ramanujan, Satyendra Nath Bose, Kalpana Chawla, Jagadish Chandra Bose, Amitabh Bachchan, Shah Rukh Khan, Dilip Kumar, Raj Kapoor, Madhubala, Nargis, Lata Mangeshkar, Kishore Kumar, Mohammed Rafi, Asha Bhosle, AR Rahman, Satyajit Ray, Ravi Shankar, Zakir Hussain, Bismillah Khan, Rabindranath Tagore.

## What would change a number here

- A real kitchen signs: replace that row with its own menu and its own prices.
- A Swiggy or Zomato export for a pin: Tier B, lifts the confidence of that kitchen to about 0.7.
- The owner's own pilot data (Tier S) beats everything above.
