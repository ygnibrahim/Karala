// English word pool, by category. 'karisik' (mixed) is the union of all categories.
// Rules (checked by tests): lowercase, drawable, family friendly, each word in only one category.
// Category ids must match shared/constants.ts → CATEGORIES.

const list = (text: string): string[] =>
  text
    .split(',')
    .map((w) => w.trim())
    .filter(Boolean);

const categories: Record<string, string[]> = {
  hayvanlar: list(`
    cat, dog, elephant, giraffe, lion, tiger, zebra, penguin, eagle, owl, snake, turtle, rabbit, squirrel, bear,
    frog, whale, shark, octopus, crab, butterfly, bee, ant, spider, snail, camel, horse, cow, sheep, chicken,
    rooster, duck, parrot, flamingo, kangaroo, monkey, crocodile, dolphin, hedgehog, fox, wolf, deer, hippo,
    rhino, seahorse, ladybug, bat, mouse, pig, goat, panda, koala, polar bear, leopard, cheetah, gorilla, llama,
    donkey, lamb, chick, turkey, goose, swan, pigeon, crow, seagull, pelican, peacock, ostrich, stork,
    woodpecker, hummingbird, hawk, vulture, starfish, jellyfish, lobster, shrimp, squid, seal, walrus, otter,
    beaver, raccoon, skunk, mole, hamster, lizard, chameleon, mosquito, fly, dragonfly, grasshopper, firefly,
    worm, caterpillar, scorpion, goldfish, clownfish, swordfish, stingray, salmon, pufferfish, kitten, puppy,
    sloth, anteater, armadillo, platypus, reindeer, hyena, antelope, flea, beetle, moose, bison, yak, mammoth
  `),

  yiyecekler: list(`
    apple, banana, strawberry, watermelon, grapes, pear, cherry, pineapple, lemon, orange, carrot, tomato,
    eggplant, corn, mushroom, onion, pizza, hamburger, ice cream, cake, cookie, pasta, french fries, sandwich,
    cotton candy, lollipop, chocolate, fish and chips, egg, cheese, bread, soup, honey, popcorn, pancake, salad,
    olive, sausage, coffee, tea, milk, juice, donut, cupcake, hot dog, taco, burrito, sushi, noodles, rice,
    potato, broccoli, cucumber, pepper, garlic, peach, plum, kiwi, coconut, avocado, mango, blueberry, peanut,
    pretzel, waffle, croissant, muffin, pie, bacon, steak, fried egg, milkshake, lemonade, smoothie, jelly,
    candy cane, gingerbread man, birthday cake, pumpkin pie, cereal, toast, butter, yogurt, spaghetti,
    meatball, chicken wing, corn dog, nachos, popsicle, marshmallow, gum, cabbage, lettuce, radish, beet, pea,
    bean, cauliflower, cinnamon roll, apple pie, cheeseburger, sundae, pickle, ketchup, mustard, jam, cracker
  `),

  esyalar: list(`
    chair, table, lamp, clock, umbrella, glasses, key, scissors, pencil, book, cup, spoon, fork, knife, plate,
    bottle, candle, mirror, pillow, bed, sofa, television, phone, camera, guitar, balloon, gift, backpack, hat,
    shoe, sock, bag, wallet, ring, necklace, crown, hammer, screwdriver, ladder, bucket, broom, toothbrush,
    comb, towel, soap, door, window, fridge, oven, kettle, teapot, frying pan, toaster, vacuum cleaner,
    washing machine, iron, hanger, basket, box, envelope, stamp, newspaper, calendar, notebook, eraser, ruler,
    paintbrush, magnet, compass, flashlight, battery, light bulb, plug, rope, chain, lock, padlock, anchor,
    fan, bell, trophy, medal, flag, map, globe, telescope, magnifying glass, hourglass, alarm clock, piggy bank,
    sunglasses, wristwatch, bow tie, zipper, button, needle, thread, safety pin, paper clip, stapler,
    tape, glue, crayon, pen, shopping cart, wheelbarrow, watering can, shovel, rake, axe, saw, drill, nail
  `),

  meslekler: list(`
    doctor, nurse, teacher, police officer, firefighter, chef, pilot, astronaut, farmer, painter, singer,
    dancer, photographer, mechanic, plumber, electrician, carpenter, builder, gardener, baker, butcher,
    hairdresser, barber, dentist, vet, scientist, engineer, programmer, lawyer, judge, soldier, sailor,
    fisherman, waiter, cashier, mail carrier, delivery driver, taxi driver, bus driver, train driver, lifeguard,
    clown, magician, juggler, actor, director, writer, reporter, librarian, detective, spy, king, queen,
    prince, princess, knight, pirate, cowboy, ninja, chef's assistant, referee, coach, athlete, boxer,
    surgeon, pharmacist, architect, tailor, shoemaker, potter, sculptor, musician, drummer, conductor,
    cleaner, janitor, security guard, zookeeper, beekeeper, shepherd, miner, lumberjack, firefighter chief,
    flight attendant, tour guide, translator, babysitter, florist, jeweler, optician, mailman, shopkeeper
  `),

  yerler: list(`
    beach, mountain, forest, desert, island, volcano, waterfall, river, lake, ocean, cave, jungle, glacier,
    city, village, farm, castle, palace, bridge, tower, lighthouse, school, hospital, library, museum,
    airport, train station, bus stop, park, playground, zoo, circus, stadium, cinema, theater, restaurant,
    cafe, bakery, supermarket, pharmacy, bank, post office, police station, fire station, gas station,
    church, mosque, temple, pyramid, igloo, tent, treehouse, skyscraper, windmill, rainbow, sun, moon, star,
    cloud, rain, snow, lightning, tornado, storm, sunset, sunrise, tree, flower, grass, leaf, rock, sand,
    hill, valley, field, garden, pond, swamp, canyon, cliff, coral reef, north pole, space, planet, galaxy,
    snowman, sandcastle, campfire, fountain, statue, road, highway, tunnel, harbor, market, factory
  `),

  eylemler: list(`
    running, jumping, swimming, flying, dancing, singing, sleeping, eating, drinking, crying, laughing,
    reading, writing, drawing, painting, cooking, cleaning, washing, driving, cycling, skating, skiing,
    climbing, fishing, shopping, walking, sitting, standing, falling, sneezing, yawning, waving, clapping,
    kicking, throwing, catching, hugging, kissing, whispering, shouting, thinking, dreaming, praying,
    knocking, digging, building, fixing, sewing, knitting, typing, texting, taking a selfie, brushing teeth,
    combing hair, juggling, surfing, diving, rowing, hiking, camping, boxing, wrestling, bowling, flipping,
    sliding, swinging, spinning, tickling, snoring, blowing bubbles, blowing out candles, carrying,
    pushing, pulling, lifting, crawling, tiptoeing, hiding, searching, waiting, sweeping, ironing,
    gardening, planting, watering, sunbathing, stretching, meditating, hitchhiking, sleepwalking
  `),

  tasitlar: list(`
    car, bus, train, airplane, helicopter, boat, ship, bicycle, motorcycle, scooter, skateboard, truck,
    tractor, ambulance, fire truck, police car, taxi, rocket, submarine, sailboat, canoe, kayak, yacht,
    hot air balloon, blimp, tram, subway, cable car, ferry, jet ski, snowmobile, sled, wagon, carriage,
    tank, jeep, van, limousine, race car, monster truck, bulldozer, crane, forklift, garbage truck,
    school bus, double decker bus, tricycle, unicycle, roller skates, spaceship, flying saucer, glider,
    parachute, raft, gondola, steam train, horse cart, tow truck, cement mixer, pickup truck, minivan,
    golf cart, go kart, paraglider, hovercraft, cruise ship, pirate ship, rowboat, motorboat, airship
  `),

  spor: list(`
    football, basketball, volleyball, tennis, baseball, golf, hockey, rugby, cricket, badminton, table tennis,
    swimming pool, boxing gloves, karate, judo, fencing, archery, bow and arrow, skiing slope, ice skating,
    snowboard, surfboard, marathon, high jump, long jump, javelin, hurdles, gymnastics, trampoline, yoga,
    weightlifting, dumbbell, treadmill, chess, checkers, dice, playing cards, puzzle, kite, yo-yo, frisbee,
    hula hoop, jump rope, see-saw, swing, slide, merry-go-round, roller coaster, ferris wheel, bowling pin,
    dartboard, pool table, video game, joystick, hide and seek, tag, tug of war, sack race, goalkeeper,
    goal, whistle, scoreboard, finish line, gold medal, podium, helmet, net, racket, ball, baseball bat, puck
  `),

  vucut: list(`
    eye, ear, nose, mouth, tooth, tongue, lips, hand, finger, thumb, foot, toe, knee, elbow, shoulder, arm,
    leg, head, hair, beard, mustache, eyebrow, eyelash, neck, back, belly, heart, brain, bone, skeleton,
    muscle, fingernail, freckles, dimple, wrist, ankle, heel, chin, cheek, forehead, shirt, t-shirt, pants,
    shorts, skirt, dress, jacket, coat, sweater, hoodie, scarf, gloves, mittens, boots, sneakers, sandals,
    slippers, high heels, cap, beanie, belt, tie, suit, pajamas, swimsuit, bikini, raincoat, apron, vest,
    earrings, bracelet, watch strap, headband, ponytail, braid, wig, tattoo, mask, uniform, overalls
  `),

  fantastik: list(`
    dragon, unicorn, mermaid, fairy, wizard, witch, ghost, vampire, zombie, werewolf, monster, giant, dwarf,
    elf, troll, goblin, ogre, phoenix, pegasus, centaur, griffin, genie, magic lamp, magic wand, crystal ball,
    flying carpet, treasure chest, treasure map, haunted house, spell book, potion, cauldron, broomstick,
    superhero, cape, robot, alien, ufo, time machine, invisibility cloak, sword, shield, armor, dungeon,
    tower princess, frog prince, gingerbread house, beanstalk, glass slipper, pumpkin carriage, magic mirror,
    sea monster, yeti, bigfoot, cyclops, minotaur, kraken, leprechaun, pot of gold, tooth fairy, santa claus,
    reindeer sleigh, easter bunny, jack-o'-lantern, mummy, skeleton king, sorcerer, knight in armor
  `),

  teknoloji: list(`
    computer, laptop, tablet, smartphone, keyboard, mouse pad, monitor, printer, headphones, microphone,
    speaker, remote control, charger, usb stick, router, satellite, antenna, radar, drone, 3d printer,
    virtual reality, smartwatch, game console, calculator, microscope, test tube, atom, dna, magnet field,
    solar panel, wind turbine, electricity, circuit, robot arm, artificial intelligence, email, wifi,
    password, cloud storage, bug, website, app, emoji, selfie stick, power bank, light saber, laser,
    hologram, telescope dish, space station, rover, lab coat, beaker, periscope, thermometer, x-ray,
    barcode, qr code, vending machine, atm, escalator, elevator, traffic light, robot vacuum, electric car
  `),

  muzik: list(`
    piano, violin, drum, trumpet, flute, saxophone, harp, cello, accordion, harmonica, xylophone, tambourine,
    triangle, banjo, ukulele, electric guitar, bagpipes, trombone, tuba, clarinet, maracas, microphone stand,
    music note, headphone jack, concert, orchestra, choir, band, rock star, disco ball, dance floor,
    karaoke, record player, cassette, radio, jukebox, metronome, sheet music, opera, ballet, painting easel,
    palette, sculpture, statue of liberty, mona lisa, museum painting, photograph, film camera, movie,
    popcorn bucket, theater mask, puppet, puppet show, origami, pottery, graffiti, comic book, cartoon,
    portrait, landscape painting, crayons box, sketchbook, stage, spotlight, applause, red carpet, ticket
  `),

  turkiye: list(`
    kebab, doner, baklava, turkish delight, turkish coffee, turkish tea, simit, pide, lahmacun, kofte,
    ayran, kunefe, dolma, borek, turkish bath, evil eye bead, carpet, kilim, fez, whirling dervish, bazaar,
    grand bazaar, spice market, galata tower, maiden's tower, bosphorus bridge, hagia sophia, blue mosque,
    cappadocia, fairy chimneys, hot air balloon ride, pamukkale, ephesus, troy horse, mount ararat,
    istanbul ferry, seagull and simit, tulip, nazar, tea glass, backgammon, okey tiles, street cat,
    shadow puppet, karagoz, nasreddin hodja, red flag, crescent and star, kebab shop, turkish ice cream,
    pomegranate, hazelnut, apricot, fig
  `),
};

export const WORDS_EN: Record<string, string[]> = {
  ...categories,
  karisik: [...new Set(Object.values(categories).flat())],
};
