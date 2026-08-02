import { mkdir, readFile, writeFile } from "node:fs/promises";

const API_KEY = process.env.FDC_API_KEY || "DEMO_KEY";
const API_URL = "https://api.nal.usda.gov/fdc/v1/foods/search";
const LOCAL_DIR = process.env.FDC_LOCAL_DIR || null;

const items = [
  ["Grains", "white rice long grain", "White rice, long grain", "dry", "generic", 45],
  ["Grains", "rolled oats", "Rolled oats", "dry", "generic", 40],
  ["Grains", "quinoa", "Quinoa", "dry", "generic", 43],
  ["Grains", "barley pearled raw", "Barley, pearled", "dry", "generic", 45],
  ["Grains", "bulgur dry", "Bulgur", "dry", "generic", 45],
  ["Grains", "whole wheat flour", "Whole-wheat flour", "dry", "generic", 30],
  ["Pulses", "lentils", "Lentils", "dry", "generic", 48],
  ["Pulses", "beans black mature seeds raw", "Black beans (dry)", "dry", "generic", 48],
  ["Pulses", "chickpeas dry", "Chickpeas (dry)", "dry", "generic", 42],
  ["Pulses", "peas split mature seeds raw", "Split peas", "dry", "generic", 48],
  ["Pulses", "beans pinto mature seeds raw", "Pinto beans (dry)", "dry", "generic", 48],
  ["Pulses", "green peas raw", "Peas, green, raw", "raw", "generic", 80],
  ["Pulses", "lentils pink or red raw", "Masoor dal (red lentils)", "dry", "generic", 48],
  ["Pulses", "lentils raw", "Whole masoor (brown lentils)", "dry", "generic", 48],
  ["Pulses", "mung beans mature seeds raw", "Whole moong beans", "dry", "generic", 48],
  ["Pulses", "mung beans mature seeds raw", "Moong dal (split mung beans)", "dry", "generic", 48],
  ["Pulses", "pigeon peas red gram mature seeds raw", "Toor dal (pigeon peas)", "dry", "generic", 48],
  ["Pulses", "chickpeas garbanzo bengal gram dry", "Chana dal (split chickpeas)", "dry", "generic", 48],
  ["Pulses", "chickpeas garbanzo bengal gram dry", "Kala chana (black chickpeas)", "dry", "generic", 48],
  ["Pulses", "kidney beans NFS", "Rajma (kidney beans)", "dry", "generic", 48],
  ["Pulses", "cowpeas common blackeyes mature seeds raw", "Lobia (black-eyed peas)", "dry", "generic", 48],
  ["Pulses", "mothbeans mature seeds raw", "Moth beans (matki)", "dry", "generic", 48],
  ["Vegetables", "spinach raw", "Spinach, raw", "raw", "generic", 30],
  ["Vegetables", "kale raw", "Kale, raw", "raw", "generic", 67],
  ["Vegetables", "broccoli raw", "Broccoli, raw", "raw", "generic", 76],
  ["Vegetables", "cauliflower raw", "Cauliflower, raw", "raw", "generic", 100],
  ["Vegetables", "carrots raw", "Carrots, raw", "raw", "generic", 61],
  ["Vegetables", "sweet potatoes orange flesh without skin raw", "Sweet potato, raw", "raw", "generic", 130],
  ["Vegetables", "potatoes russet flesh and skin raw", "Potatoes, russet, flesh and skin, raw", "raw", "generic", 213],
  ["Vegetables", "tomatoes red ripe raw year round average", "Tomatoes, red, ripe, raw", "raw", "generic", 123],
  ["Vegetables", "cucumber raw", "Cucumber, with peel, raw", "raw", "generic", 104],
  ["Vegetables", "onions raw", "Onions, raw", "raw", "generic", 160],
  ["Vegetables", "peppers sweet red raw", "Peppers, sweet, red, raw", "raw", "generic", 149],
  ["Vegetables", "zucchini raw", "Squash, summer, zucchini, includes skin, raw", "raw", "generic", 124],
  ["Vegetables", "mushrooms raw", "Mushrooms, white, raw", "raw", "generic", 70],
  ["Vegetables", "romaine lettuce raw", "Romaine lettuce", "raw", "generic", 47],
  ["Vegetables", "cabbage raw", "Cabbage", "raw", "generic", 89],
  ["Vegetables", "green beans raw", "Green beans", "raw", "generic", 100],
  ["Vegetables", "asparagus raw", "Asparagus", "raw", "generic", 134],
  ["Vegetables", "celery raw", "Celery", "raw", "generic", 101],
  ["Vegetables", "garlic raw", "Garlic", "raw", "generic", 3],
  ["Fruit", "apples raw with skin", "Apples, raw, with skin", "raw", "generic", 182],
  ["Fruit", "bananas raw", "Bananas, raw", "raw", "generic", 118],
  ["Fruit", "oranges raw all commercial varieties", "Oranges, raw, all commercial varieties", "raw", "generic", 140],
  ["Fruit", "strawberries raw", "Strawberries, raw", "raw", "generic", 152],
  ["Fruit", "blueberries raw", "Blueberries, raw", "raw", "generic", 148],
  ["Fruit", "grapes raw", "Grapes, red or green", "raw", "generic", 151],
  ["Fruit", "avocados raw all commercial varieties", "Avocados, raw, all commercial varieties", "raw", "generic", 150],
  ["Fruit", "mangos raw", "Mangos, raw", "raw", "generic", 165],
  ["Fruit", "pineapple raw all varieties", "Pineapple, raw, all varieties", "raw", "generic", 165],
  ["Fruit", "lemons raw without peel", "Lemons, raw, without peel", "raw", "generic", 58],
  ["Fruit", "pear raw", "Pear", "raw", "generic", 178],
  ["Fruit", "peach raw", "Peach", "raw", "generic", 150],
  ["Fruit", "watermelon raw", "Watermelon", "raw", "generic", 152],
  ["Fruit", "raspberries raw", "Raspberries", "raw", "generic", 123],
  ["Fruit", "kiwifruit raw", "Kiwifruit", "raw", "generic", 69],
  ["Proteins", "chicken breast raw", "Chicken, broilers or fryers, breast, meat only, raw", "raw", "generic", 174],
  ["Proteins", "ground beef 90 lean raw", "Beef, ground, 90% lean meat / 10% fat, raw", "raw", "generic", 113],
  ["Proteins", "pork loin raw", "Pork, fresh, loin, tenderloin, separable lean only, raw", "raw", "generic", 113],
  ["Proteins", "turkey breast raw", "Turkey, retail parts, breast, meat only, raw", "raw", "generic", 112],
  ["Proteins", "ground turkey raw", "Ground turkey", "raw", "generic", 112],
  ["Proteins", "tofu raw", "Tofu", "raw", "generic", 81],
  ["Seafood", "salmon raw", "Fish, salmon, Atlantic, wild, raw", "raw", "generic", 140],
  ["Seafood", "tuna raw", "Fish, tuna, light, fresh, raw", "raw", "generic", 113],
  ["Seafood", "shrimp raw", "Crustaceans, shrimp, mixed species, raw", "raw", "generic", 85],
  ["Seafood", "tilapia raw", "Fish, tilapia, raw", "raw", "generic", 116],
  ["Seafood", "cod raw", "Cod", "raw", "generic", 85],
  ["Dairy & eggs", "egg raw", "Egg, whole, raw, fresh", "raw", "generic", 50],
  ["Dairy & eggs", "milk whole milkfat vitamin d", "Milk, whole, 3.25% milkfat, with added vitamin D", "raw", "generic", 244],
  ["Dairy & eggs", "milk reduced fat", "Milk, reduced fat (2%)", "raw", "generic", 244],
  ["Dairy & eggs", "milk low fat", "Milk, low fat (1%)", "raw", "generic", 244],
  ["Dairy & eggs", "milk fat free skim", "Milk, fat free (skim)", "raw", "generic", 245],
  ["Dairy & eggs", "milk lactose free whole", "Milk, lactose free, whole", "raw", "generic", 244],
  ["Dairy & eggs", "milk lactose free reduced fat", "Milk, lactose free, reduced fat (2%)", "raw", "generic", 244],
  ["Dairy & eggs", "milk lactose free low fat", "Milk, lactose free, low fat (1%)", "raw", "generic", 244],
  ["Dairy & eggs", "milk lactose free fat free skim", "Milk, lactose free, fat free (skim)", "raw", "generic", 245],
  ["Dairy & eggs", "goat milk", "Goat milk", "raw", "generic", 244],
  ["Dairy & eggs", "sheep milk fluid", "Sheep milk", "raw", "generic", 244],
  ["Dairy & eggs", "indian buffalo milk fluid", "Buffalo milk", "raw", "generic", 244],
  ["Milk & alternatives", "soy milk unsweetened", "Soy milk, unsweetened", "raw", "generic", 240],
  ["Milk & alternatives", "almond milk unsweetened", "Almond milk, unsweetened", "raw", "generic", 240],
  ["Milk & alternatives", "oat milk unsweetened plain refrigerated", "Oat milk, unsweetened", "raw", "generic", 240],
  ["Milk & alternatives", "rice milk unsweetened", "Rice milk, unsweetened", "raw", "generic", 240],
  ["Dairy & eggs", "yogurt greek plain whole milk", "Yogurt, Greek, plain, whole milk", "raw", "generic", 170],
  ["Dairy & eggs", "cheese cheddar", "Cheese, cheddar", "raw", "generic", 28],
  ["Nuts & seeds", "almonds raw", "Nuts, almonds, whole, raw", "raw", "generic", 28],
  ["Nuts & seeds", "walnuts raw", "Nuts, walnuts, English, halves, raw", "raw", "generic", 28],
  ["Nuts & seeds", "peanuts raw", "Peanuts, all types, raw", "raw", "generic", 28],
  ["Nuts & seeds", "chia seeds", "Chia seeds", "dry", "generic", 28],
  ["Nuts & seeds", "flaxseed", "Flaxseed", "dry", "generic", 10],
  ["Nuts & seeds", "pumpkin seeds", "Pumpkin seeds", "dry", "generic", 28],
  ["Nuts & seeds", "cashews unroasted", "Cashews", "raw", "generic", 28],
  ["Nuts & seeds", "pecans raw", "Pecans", "raw", "generic", 28],
  ["Nuts & seeds", "sunflower seeds", "Sunflower seeds", "dry", "generic", 28],
  ["Oils", "olive oil", "Olive oil", "raw", "generic", 14],
  ["Oils", "canola oil", "Canola oil", "raw", "generic", 14],
  ["Canned", "canned black beans", "Canned black beans", "canned", "generic", 130],
  ["Canned", "canned chickpeas", "Canned chickpeas", "canned", "generic", 125],
  ["Canned", "canned corn", "Canned corn", "canned", "generic", 140],
  ["Canned", "canned tomatoes", "Canned tomatoes", "canned", "generic", 121],
  ["Canned", "canned green beans", "Canned green beans", "canned", "generic", 135],
  ["Canned", "canned peas", "Canned peas", "canned", "generic", 145],
  ["Frozen", "spinach frozen unprepared", "Frozen spinach", "frozen", "generic", 91],
  ["Frozen", "peas green frozen unprepared", "Frozen peas", "frozen", "generic", 80],
  ["Frozen", "broccoli frozen unprepared", "Frozen broccoli", "frozen", "generic", 85],
  ["Frozen", "frozen strawberries", "Frozen strawberries", "frozen", "generic", 140],
  ["Frozen", "corn sweet yellow frozen kernels cut off cob unprepared", "Frozen corn", "frozen", "generic", 100],
  ["Frozen", "edamame frozen unprepared", "Frozen edamame", "frozen", "generic", 78],
  ["Walmart / Great Value", "Great Value long grain white rice", "Long Grain White Rice", "dry", "branded", 45],
  ["Walmart / Great Value", "Great Value old fashioned oats", "Old Fashioned Oats", "dry", "branded", 40],
  ["Walmart / Great Value", "Great Value black beans", "Black Beans", "canned", "branded", 130],
  ["Walmart / Great Value", "Great Value frozen broccoli", "Broccoli Florets", "frozen", "branded", 85]
];

const nutrientMap = {
  1003: ["protein", "g"], 1004: ["fat", "g"], 1005: ["carbs", "g"], 1008: ["calories", "kcal"], 2047: ["calories", "kcal"], 2048: ["calories", "kcal"],
  1079: ["fiber", "g"], 2000: ["sugars", "g"], 1258: ["satFat", "g"], 1257: ["transFat", "g"],
  1253: ["cholesterol", "mg"], 1093: ["sodium", "mg"], 1087: ["calcium", "mg"], 1089: ["iron", "mg"],
  1090: ["magnesium", "mg"], 1091: ["phosphorus", "mg"], 1092: ["potassium", "mg"], 1095: ["zinc", "mg"],
  1098: ["copper", "mg"], 1103: ["selenium", "mcg"], 1106: ["vitaminA", "mcg"], 1109: ["vitaminE", "mg"],
  1114: ["vitaminD", "mcg"], 1162: ["vitaminC", "mg"], 1165: ["thiamin", "mg"], 1166: ["riboflavin", "mg"],
  1167: ["niacin", "mg"], 1175: ["vitaminB6", "mg"], 1178: ["vitaminB12", "mcg"], 1180: ["choline", "mg"],
  1185: ["vitaminK", "mcg"], 1190: ["folate", "mcg"]
};

// Household defaults for staple foods whose source record gives a gram serving
// but does not include a convenient cup or tablespoon portion.
const householdDefaults = {
  "White rice, long grain": { unit: "cup", amount: .25, grams: 45, cupGrams: 180 },
  "Rolled oats": { unit: "cup", amount: .5, grams: 40, cupGrams: 80 },
  "Quinoa": { unit: "cup", amount: .25, grams: 43, cupGrams: 172 },
  "Barley, pearled": { unit: "cup", amount: .25, grams: 45, cupGrams: 180 },
  "Bulgur": { unit: "cup", amount: .25, grams: 45, cupGrams: 180 },
  "Whole-wheat flour": { unit: "cup", amount: .25, grams: 30, cupGrams: 120 },
  "Lentils": { unit: "cup", amount: .25, grams: 48, cupGrams: 192 },
  "Black beans (dry)": { unit: "cup", amount: .25, grams: 48, cupGrams: 192 },
  "Chickpeas (dry)": { unit: "cup", amount: .25, grams: 42, cupGrams: 168 },
  "Split peas": { unit: "cup", amount: .25, grams: 48, cupGrams: 192 },
  "Pinto beans (dry)": { unit: "cup", amount: .25, grams: 48, cupGrams: 192 },
  "Masoor dal (red lentils)": { unit: "cup", amount: .25, grams: 48, cupGrams: 192 },
  "Whole masoor (brown lentils)": { unit: "cup", amount: .25, grams: 48, cupGrams: 192 },
  "Whole moong beans": { unit: "cup", amount: .25, grams: 48, cupGrams: 192 },
  "Moong dal (split mung beans)": { unit: "cup", amount: .25, grams: 48, cupGrams: 192 },
  "Toor dal (pigeon peas)": { unit: "cup", amount: .25, grams: 48, cupGrams: 192 },
  "Chana dal (split chickpeas)": { unit: "cup", amount: .25, grams: 48, cupGrams: 192 },
  "Kala chana (black chickpeas)": { unit: "cup", amount: .25, grams: 48, cupGrams: 192 },
  "Rajma (kidney beans)": { unit: "cup", amount: .25, grams: 48, cupGrams: 192 },
  "Lobia (black-eyed peas)": { unit: "cup", amount: .25, grams: 48, cupGrams: 192 },
  "Moth beans (matki)": { unit: "cup", amount: .25, grams: 48, cupGrams: 192 },
  "Peas, green, raw": { unit: "cup", amount: .5, grams: 72.5, cupGrams: 145 },
  "Spinach, raw": { unit: "cup", amount: 1, grams: 30, cupGrams: 30 },
  "Potatoes, russet, flesh and skin, raw": { unit: "cup", amount: .5, grams: 75, cupGrams: 150 },
  "Tomatoes, red, ripe, raw": { unit: "cup", amount: .5, grams: 90, cupGrams: 180 },
  "Peppers, sweet, red, raw": { unit: "cup", amount: .5, grams: 74.5, cupGrams: 149 },
  "Cauliflower, raw": { unit: "cup", amount: .5, grams: 53.5, cupGrams: 107 },
  "Carrots, raw": { unit: "cup", amount: .5, grams: 64, cupGrams: 128 },
  "Sweet potato, raw": { unit: "cup", amount: .5, grams: 66.5, cupGrams: 133 },
  "Cucumber, with peel, raw": { unit: "cup", amount: .5, grams: 52, cupGrams: 104 },
  "Onions, raw": { unit: "cup", amount: .5, grams: 80, cupGrams: 160 },
  "Squash, summer, zucchini, includes skin, raw": { unit: "cup", amount: .5, grams: 62, cupGrams: 124 },
  "Mushrooms, white, raw": { unit: "cup", amount: .5, grams: 35, cupGrams: 70 },
  "Cabbage": { unit: "cup", amount: .5, grams: 44.5, cupGrams: 89 },
  "Green beans": { unit: "cup", amount: .5, grams: 50, cupGrams: 100 },
  "Asparagus": { unit: "cup", amount: .5, grams: 67, cupGrams: 134 },
  "Celery": { unit: "cup", amount: .5, grams: 50.5, cupGrams: 101 },
  "Garlic": { unit: "tbsp", amount: 1, grams: 8.5, tbspGrams: 8.5 },
  "Apples, raw, with skin": { unit: "cup", amount: .5, grams: 54.5, cupGrams: 109 },
  "Bananas, raw": { unit: "cup", amount: .5, grams: 75, cupGrams: 150 },
  "Oranges, raw, all commercial varieties": { unit: "cup", amount: .5, grams: 90, cupGrams: 180 },
  "Strawberries, raw": { unit: "cup", amount: .5, grams: 76, cupGrams: 152 },
  "Blueberries, raw": { unit: "cup", amount: .5, grams: 74, cupGrams: 148 },
  "Grapes, red or green": { unit: "cup", amount: .5, grams: 75.5, cupGrams: 151 },
  "Avocados, raw, all commercial varieties": { unit: "cup", amount: .5, grams: 75, cupGrams: 150 },
  "Mangos, raw": { unit: "cup", amount: .5, grams: 82.5, cupGrams: 165 },
  "Pineapple, raw, all varieties": { unit: "cup", amount: .5, grams: 82.5, cupGrams: 165 },
  "Lemons, raw, without peel": { unit: "cup", amount: .25, grams: 53, cupGrams: 212 },
  "Watermelon": { unit: "cup", amount: .5, grams: 76, cupGrams: 152 },
  "Raspberries": { unit: "cup", amount: .5, grams: 61.5, cupGrams: 123 },
  "Kiwifruit": { unit: "cup", amount: .5, grams: 90, cupGrams: 180 },
  "Milk, whole, 3.25% milkfat, with added vitamin D": { unit: "cup", amount: 1, grams: 249, cupGrams: 249 },
  "Milk, reduced fat (2%)": { unit: "cup", amount: 1, grams: 244, cupGrams: 244 },
  "Milk, low fat (1%)": { unit: "cup", amount: 1, grams: 244, cupGrams: 244 },
  "Milk, fat free (skim)": { unit: "cup", amount: 1, grams: 245, cupGrams: 245 },
  "Milk, lactose free, whole": { unit: "cup", amount: 1, grams: 244, cupGrams: 244 },
  "Milk, lactose free, reduced fat (2%)": { unit: "cup", amount: 1, grams: 244, cupGrams: 244 },
  "Milk, lactose free, low fat (1%)": { unit: "cup", amount: 1, grams: 244, cupGrams: 244 },
  "Milk, lactose free, fat free (skim)": { unit: "cup", amount: 1, grams: 245, cupGrams: 245 },
  "Goat milk": { unit: "cup", amount: 1, grams: 244, cupGrams: 244 },
  "Sheep milk": { unit: "cup", amount: 1, grams: 244, cupGrams: 244 },
  "Buffalo milk": { unit: "cup", amount: 1, grams: 244, cupGrams: 244 },
  "Soy milk, unsweetened": { unit: "cup", amount: 1, grams: 240, cupGrams: 240 },
  "Almond milk, unsweetened": { unit: "cup", amount: 1, grams: 240, cupGrams: 240 },
  "Oat milk, unsweetened": { unit: "cup", amount: 1, grams: 240, cupGrams: 240 },
  "Rice milk, unsweetened": { unit: "cup", amount: 1, grams: 240, cupGrams: 240 },
  "Yogurt, Greek, plain, whole milk": { unit: "cup", amount: .75, grams: 170, cupGrams: 227 },
  "Cheese, cheddar": { unit: "cup", amount: .25, grams: 26.25, cupGrams: 105 },
  "Nuts, almonds, whole, raw": { unit: "tbsp", amount: 2, grams: 18, tbspGrams: 9, cupGrams: 143 },
  "Nuts, walnuts, English, halves, raw": { unit: "tbsp", amount: 2, grams: 15, tbspGrams: 7.5, cupGrams: 117 },
  "Peanuts, all types, raw": { unit: "tbsp", amount: 2, grams: 18, tbspGrams: 9, cupGrams: 146 },
  "Pecans": { unit: "tbsp", amount: 2, grams: 15, tbspGrams: 7.5, cupGrams: 109 },
  "Chia seeds": { unit: "tbsp", amount: 2, grams: 28, tbspGrams: 14 },
  "Flaxseed": { unit: "tbsp", amount: 1, grams: 10, tbspGrams: 10 },
  "Pumpkin seeds": { unit: "tbsp", amount: 2, grams: 28, tbspGrams: 14 },
  "Sunflower seeds": { unit: "tbsp", amount: 2, grams: 28, tbspGrams: 14 },
  "Olive oil": { unit: "tbsp", amount: 1, grams: 14, tbspGrams: 14 },
  "Canola oil": { unit: "tbsp", amount: 1, grams: 14, tbspGrams: 14 },
  "Canned black beans": { unit: "cup", amount: .5, grams: 86, cupGrams: 172 },
  "Canned chickpeas": { unit: "cup", amount: .5, grams: 82, cupGrams: 164 },
  "Canned corn": { unit: "cup", amount: .5, grams: 82, cupGrams: 164 },
  "Canned tomatoes": { unit: "cup", amount: .5, grams: 122.5, cupGrams: 245 },
  "Canned green beans": { unit: "cup", amount: .5, grams: 64.5, cupGrams: 129 },
  "Canned peas": { unit: "cup", amount: .5, grams: 80, cupGrams: 160 },
  "Frozen spinach": { unit: "cup", amount: .5, grams: 95, cupGrams: 190 },
  "Frozen peas": { unit: "cup", amount: .5, grams: 92.5, cupGrams: 185 },
  "Frozen broccoli": { unit: "cup", amount: .5, grams: 92, cupGrams: 184 },
  "Frozen strawberries": { unit: "cup", amount: .5, grams: 75, cupGrams: 150 },
  "Frozen corn": { unit: "cup", amount: .5, grams: 82, cupGrams: 164 },
  "Frozen edamame": { unit: "cup", amount: .5, grams: 77.5, cupGrams: 155 }
};

// Countable household measures are separate from cups and tablespoons. Values
// are source-backed where the selected USDA record has a clear piece portion;
// otherwise they are conservative common-serving references documented in the
// catalog review notes.
const countDefaults = {
  "Carrots, raw": { unit: "carrot", plural: "carrots", grams: 61, source: "USDA FoodData Central", defaultAmount: 1 },
  "Sweet potato, raw": { unit: "sweet potato", plural: "sweet potatoes", grams: 130, source: "USDA FoodData Central", defaultAmount: 1 },
  "Potatoes, russet, flesh and skin, raw": { unit: "potato", plural: "potatoes", grams: 213, source: "USDA FoodData Central", defaultAmount: 1 },
  "Tomatoes, red, ripe, raw": { unit: "tomato", plural: "tomatoes", grams: 123, source: "USDA FoodData Central", defaultAmount: 1 },
  "Cucumber, with peel, raw": { unit: "cucumber", plural: "cucumbers", grams: 200, source: "USDA FoodData Central", defaultAmount: 1 },
  "Onions, raw": { unit: "onion", plural: "onions", grams: 160, source: "USDA FoodData Central", defaultAmount: 1 },
  "Peppers, sweet, red, raw": { unit: "pepper", plural: "peppers", grams: 149, source: "USDA FoodData Central", defaultAmount: 1 },
  "Squash, summer, zucchini, includes skin, raw": { unit: "zucchini", plural: "zucchini", grams: 124, source: "USDA FoodData Central", defaultAmount: 1 },
  "Mushrooms, white, raw": { unit: "mushroom", plural: "mushrooms", grams: 18, source: "USDA FoodData Central", defaultAmount: 1 },
  "Romaine lettuce": { unit: "leaf", plural: "leaves", grams: 13, source: "USDA FoodData Central", defaultAmount: 1 },
  "Green beans": { unit: "bean", plural: "beans", grams: 6, source: "USDA FoodData Central", defaultAmount: 1 },
  "Asparagus": { unit: "spear", plural: "spears", grams: 17, source: "Common household reference", defaultAmount: 1 },
  "Celery": { unit: "stalk", plural: "stalks", grams: 40, source: "Common household reference", defaultAmount: 1 },
  "Garlic": { unit: "clove", plural: "cloves", grams: 3, source: "Common household reference", defaultAmount: 1, default: true },
  "Apples, raw, with skin": { unit: "apple", plural: "apples", grams: 182, source: "USDA FoodData Central", defaultAmount: 1, default: true },
  "Bananas, raw": { unit: "banana", plural: "bananas", grams: 118, source: "USDA FoodData Central", defaultAmount: 1, default: true },
  "Oranges, raw, all commercial varieties": { unit: "orange", plural: "oranges", grams: 140, source: "USDA FoodData Central", defaultAmount: 1, default: true },
  "Strawberries, raw": { unit: "strawberry", plural: "strawberries", grams: 12, source: "Common household reference" },
  "Grapes, red or green": { unit: "grape", plural: "grapes", grams: 7, source: "USDA FoodData Central" },
  "Avocados, raw, all commercial varieties": { unit: "avocado", plural: "avocados", grams: 150, source: "USDA FoodData Central", defaultAmount: 1, default: true },
  "Mangos, raw": { unit: "mango", plural: "mangos", grams: 165, source: "USDA FoodData Central", defaultAmount: 1, default: true },
  "Lemons, raw, without peel": { unit: "lemon", plural: "lemons", grams: 58, source: "USDA FoodData Central" },
  "Pear": { unit: "pear", plural: "pears", grams: 180, source: "USDA FoodData Central", defaultAmount: 1, default: true },
  "Peach": { unit: "peach", plural: "peaches", grams: 150, source: "USDA FoodData Central", defaultAmount: 1, default: true },
  "Kiwifruit": { unit: "kiwi", plural: "kiwis", grams: 69, source: "USDA FoodData Central", defaultAmount: 1, default: true },
  "Cheese, cheddar": { unit: "slice", plural: "slices", grams: 17, source: "USDA FoodData Central", defaultAmount: 1, default: true },
  "Egg, whole, raw, fresh": { unit: "egg", plural: "eggs", grams: 50, source: "USDA FoodData Central", defaultAmount: 1, default: true },
  "Nuts, almonds, whole, raw": { unit: "almond", plural: "almonds", grams: 1.2, source: "Common household reference" },
  "Nuts, walnuts, English, halves, raw": { unit: "walnut half", plural: "walnut halves", grams: 4, source: "Common household reference" },
  "Peanuts, all types, raw": { unit: "peanut", plural: "peanuts", grams: 1, source: "Common household reference" },
  "Cashews": { unit: "cashew", plural: "cashews", grams: 1.5, source: "USDA FoodData Central" },
  "Pecans": { unit: "pecan half", plural: "pecan halves", grams: 2, source: "Common household reference" },
  "Frozen strawberries": { unit: "berry", plural: "berries", grams: 18, source: "USDA FoodData Central" }
};

function slug(value) {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");
}

function normalizeNutrients(food) {
  const nutrients = {};
  for (const nutrient of food.foodNutrients || []) {
    const nutrientId = nutrient.nutrientId ?? nutrient.nutrient?.id;
    const mapped = nutrientMap[nutrientId];
    const value = nutrient.value ?? nutrient.amount ?? null;
    if (mapped && nutrients[mapped[0]] === undefined) nutrients[mapped[0]] = { value, unit: mapped[1] };
  }
  return nutrients;
}

function measureFor(food, unit) {
  const measures = [...(food.foodMeasures || []), ...(food.foodPortions || [])];
  const match = measures.find((measure) => {
    const name = measure.measureUnitName || measure.measureUnit?.name || "";
    const text = measure.disseminationText || measure.portionDescription || "";
    const normalizedText = text.toLowerCase();
    return name.toLowerCase() === unit || normalizedText === unit || normalizedText.includes(`1 ${unit}`);
  });
  return match?.gramWeight || null;
}

function portionOptionsFor(food) {
  const measures = [...(food.foodMeasures || []), ...(food.foodPortions || [])];
  const seen = new Set();
  return measures.map((measure) => {
    const label = measure.disseminationText || measure.portionDescription || measure.measureUnitName || measure.measureUnit?.name || "";
    return { label: label.trim(), grams: measure.gramWeight || null };
  }).filter((portion) => {
    const label = portion.label.toLowerCase();
    if (!portion.label || !portion.grams || seen.has(label) || /quantity not specified|guideline amount|racc|undetermined/.test(label)) return false;
    seen.add(label);
    return true;
  }).slice(0, 8);
}

async function search(query, type) {
  if (LOCAL_DIR && type !== "branded") return searchLocal(query);
  const params = new URLSearchParams({ api_key: API_KEY, query, pageSize: "8", dataType: type === "branded" ? "Branded" : "Foundation,SR Legacy,Survey (FNDDS)" });
  const response = await fetch(`${API_URL}?${params}`);
  if (!response.ok) throw new Error(`${response.status} while searching ${query}`);
  const body = await response.json();
  const normalizedQuery = query.toLowerCase().replace(/[^a-z0-9 ]/g, "");
  const sorted = (body.foods || []).sort((a, b) => {
    const aExact = a.description.toLowerCase().includes(normalizedQuery) ? 1 : 0;
    const bExact = b.description.toLowerCase().includes(normalizedQuery) ? 1 : 0;
    return bExact - aExact || (b.score || 0) - (a.score || 0);
  });
  if (!sorted[0]) throw new Error(`No USDA result for ${query}`);
  return sorted[0];
}

let localFoodsPromise;
async function loadLocalFoods() {
  if (!localFoodsPromise) {
    localFoodsPromise = Promise.all([
      readFile(`${LOCAL_DIR}/FoodData_Central_foundation_food_json_2026-04-30.json`, "utf8").then((raw) => JSON.parse(raw).FoundationFoods),
      readFile(`${LOCAL_DIR}/FoodData_Central_sr_legacy_food_json_2018-04.json`, "utf8").then((raw) => JSON.parse(raw).SRLegacyFoods),
      readFile(`${LOCAL_DIR}/surveyDownload.json`, "utf8").then((raw) => JSON.parse(raw).SurveyFoods)
    ]).then(([foundation, legacy, survey]) => [...foundation, ...legacy, ...survey]);
  }
  return localFoodsPromise;
}

function scoreLocalFood(food, query) {
  const description = (food.description || "").toLowerCase();
  const normalizedDescription = description.replace(/[^a-z0-9]+/g, " ").replace(/\s+/g, " ").trim();
  const normalizedQuery = query.toLowerCase().replace(/[^a-z0-9]+/g, " ").replace(/\s+/g, " ").trim();
  const containsTerm = (term) => new RegExp(`\\b${term.replace(/[.*+?^${}()|[\]\\]/g, "\\\\$&")}\\b`).test(description);
  const queryTerms = query.toLowerCase().split(/\s+/);
  const stateTerms = queryTerms.filter((term) => ["raw", "dry", "canned", "frozen"].includes(term));
  const terms = queryTerms.filter((term) => !stateTerms.includes(term));
  const matched = terms.filter(containsTerm).length;
  if (matched !== terms.length) return -100;
  const stateMatch = stateTerms.filter(containsTerm).length;
  const missingState = stateTerms.length && stateMatch !== stateTerms.length ? -50 : 0;
  const unrequestedState = ["cooked", "boiled", "baked", "fried", "roasted", "prepared", "frozen", "canned"].filter((term) => !stateTerms.includes(term) && description.includes(term)).length * -18;
  const unwanted = /(with salt|sauce|sweetened|flour)/.test(description) && !query.includes("flour") ? -35 : 0;
  const phrase = normalizedDescription.includes(normalizedQuery) ? 70 : 0;
  const exact = normalizedDescription === normalizedQuery ? 100 : 0;
  return exact + phrase + matched * 10 + stateMatch * 12 + missingState + unrequestedState + unwanted;
}

async function searchLocal(query) {
  const foods = await loadLocalFoods();
  const ranked = foods.filter(Boolean).map((food) => ({ food, score: scoreLocalFood(food, query) })).filter((entry) => entry.score > 0).sort((a, b) => b.score - a.score);
  if (!ranked[0]) throw new Error(`No local USDA result for ${query}`);
  return ranked[0].food;
}

const catalog = [];
for (const [group, query, displayName, state, type, servingGrams] of items) {
  try {
    const food = await search(query, type);
    const household = householdDefaults[displayName] || {};
    const count = countDefaults[displayName] || null;
    const sourcedCupGrams = measureFor(food, "cup");
    const sourcedTbspGrams = measureFor(food, "tablespoon") || measureFor(food, "tbsp");
    catalog.push({
      id: `${type}-${slug(displayName)}`,
      name: type === "branded" ? `Great Value ${displayName}` : displayName,
      aliases: [query, displayName],
      group,
      state,
      sourceType: type,
      source: "USDA FoodData Central",
      fdcId: food.fdcId,
      sourceDescription: food.description,
      publishedDate: food.publishedDate || food.publicationDate || null,
      servingGrams,
      cupGrams: sourcedCupGrams || household.cupGrams || null,
      cupSource: sourcedCupGrams ? "USDA FoodData Central" : household.cupGrams ? "Curated household default" : null,
      tbspGrams: sourcedTbspGrams || household.tbspGrams || null,
      tbspSource: sourcedTbspGrams ? "USDA FoodData Central" : household.tbspGrams ? "Curated household default" : null,
      defaultUnit: household.unit || null,
      defaultAmount: household.amount || null,
      countMeasure: count,
      portionOptions: portionOptionsFor(food),
      per100g: normalizeNutrients(food)
    });
    console.log(`✓ ${displayName} (${food.fdcId})`);
  } catch (error) {
    console.error(`! ${displayName}: ${error.message}`);
  }
}

await mkdir("data", { recursive: true });
const output = `window.PANTRY_CATALOG = ${JSON.stringify(catalog, null, 2)};\n`;
await writeFile("data/catalog-data.js", output);
console.log(`Wrote ${catalog.length} records to data/catalog-data.js`);
