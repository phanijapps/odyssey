import {
  multipleChoiceInteraction,
  trueFalseInteraction,
  type LearnerQuestionInteraction,
} from "../validators/question-interactions";

/** A reviewed practice question with its answer, optional hint, and diagram. */
export type QuestionBankEntry = {
  readonly question: string;
  readonly expectedAnswer: string;
  readonly acceptableAnswers?: readonly string[];
  /** Server-chosen response shape; its correct option is never identified. */
  readonly interaction?: LearnerQuestionInteraction;
  readonly hint: string;
  readonly diagramSvg: string;
};

/** Reviewed question bank keyed by topic id, each entry tagged with a level tier. */
export const questionBank: Readonly<
  Record<string, readonly QuestionBankEntry[]>
> = {
  ratio: [
    {
      question:
        "A recipe uses 2 cups of flour for every 1 cup of sugar. What is the ratio of flour to sugar? (Use the format number:number)",
      expectedAnswer: "2:1",
      acceptableAnswers: ["2 to 1"],
      hint: "Count the cups of flour first, then the cups of sugar.",
      diagramSvg:
        '<svg xmlns="http://www.w3.org/2000/svg" aria-label="ratio diagram" viewBox="0 0 200 80"><rect x="10" y="20" width="80" height="40" rx="8" fill="#d4a72c" /><rect x="100" y="20" width="40" height="40" rx="8" fill="#8fc9dc" /><text x="50" y="75" fill="#333333">flour</text><text x="120" y="75" fill="#333333">sugar</text></svg>',
    },
    {
      question:
        "In a classroom, the ratio of boys to girls is 3:2. If there are 6 boys, how many girls are there?",
      expectedAnswer: "4",
      acceptableAnswers: ["4 girls"],
      interaction: multipleChoiceInteraction(
        "In a classroom, the ratio of boys to girls is 3:2. If there are 6 boys, how many girls are there?",
        ["2", "4", "6", "8"],
      ),
      hint: "3 boys to 2 girls. If 3 becomes 6 (doubled), what does 2 become?",
      diagramSvg:
        '<svg xmlns="http://www.w3.org/2000/svg" aria-label="ratio diagram" viewBox="0 0 200 80"><rect x="10" y="20" width="30" height="30" rx="4" fill="#6b9bd8" /><rect x="45" y="20" width="30" height="30" rx="4" fill="#6b9bd8" /><rect x="80" y="20" width="30" height="30" rx="4" fill="#6b9bd8" /><rect x="130" y="20" width="30" height="30" rx="4" fill="#e88b8b" /><rect x="165" y="20" width="30" height="30" rx="4" fill="#e88b8b" /><text x="60" y="65" fill="#333333">boys</text><text x="160" y="65" fill="#333333">girls</text></svg>',
    },
    {
      question:
        "A smoothie uses 3 strawberries for every 1 banana. If you use 9 strawberries, how many bananas do you need?",
      expectedAnswer: "3",
      acceptableAnswers: ["3 bananas"],
      hint: "9 strawberries is 3 times the original 3. What is 3 times 1?",
      diagramSvg:
        '<svg xmlns="http://www.w3.org/2000/svg" aria-label="ratio diagram" viewBox="0 0 200 80"><circle cx="30" cy="35" r="12" fill="#e23b3b" /><circle cx="55" cy="35" r="12" fill="#e23b3b" /><circle cx="80" cy="35" r="12" fill="#e23b3b" /><rect x="120" y="22" width="30" height="26" rx="6" fill="#f0d04e" /><text x="55" y="70" fill="#333333">strawberries</text><text x="135" y="70" fill="#333333">banana</text></svg>',
    },
    {
      question:
        "The ratio of red to blue marbles in a bag is 5:3. If there are 40 marbles total, how many are red?",
      expectedAnswer: "25",
      acceptableAnswers: ["25 marbles"],
      hint: "There are 8 parts total (5+3). 40 divided by 8 gives the size of each part.",
      diagramSvg:
        '<svg xmlns="http://www.w3.org/2000/svg" aria-label="ratio diagram" viewBox="0 0 200 80"><text x="60" y="40" fill="#333333">5 red</text><text x="130" y="40" fill="#333333">3 blue</text><text x="80" y="65" fill="#666666">Total = 40</text></svg>',
    },
    {
      question:
        "True or false: A car that travels 240 miles on 8 gallons uses 30 miles per gallon.",
      expectedAnswer: "true",
      interaction: trueFalseInteraction(
        "True or false: A car that travels 240 miles on 8 gallons uses 30 miles per gallon.",
      ),
      hint: "Divide miles by gallons to find the miles traveled per gallon.",
      diagramSvg:
        '<svg xmlns="http://www.w3.org/2000/svg" aria-label="ratio diagram" viewBox="0 0 200 80"><text x="30" y="35" fill="#333333">240 miles</text><text x="120" y="35" fill="#333333">8 gallons</text><text x="70" y="60" fill="#666666">miles : gallons = ?</text></svg>',
    },
    {
      question:
        "Two numbers are in a ratio of 7:4. If the smaller number is 28, what is the larger number?",
      expectedAnswer: "49",
      hint: "The smaller number (4 parts) is 28. What is 1 part? Then what are 7 parts?",
      diagramSvg:
        '<svg xmlns="http://www.w3.org/2000/svg" aria-label="ratio diagram" viewBox="0 0 200 80"><text x="40" y="40" fill="#333333">7 parts</text><text x="120" y="40" fill="#333333">4 parts = 28</text></svg>',
    },
  ],

  "unit-rate": [
    {
      question:
        "A store sells 5 apples for $2.50. What is the unit price per apple?",
      expectedAnswer: "0.50",
      acceptableAnswers: ["0.5", "$0.50", "50 cents"],
      hint: "Divide the total price by the number of apples.",
      diagramSvg:
        '<svg xmlns="http://www.w3.org/2000/svg" aria-label="unit rate diagram" viewBox="0 0 200 80"><circle cx="30" cy="30" r="12" fill="#e23b3b" /><circle cx="55" cy="30" r="12" fill="#e23b3b" /><circle cx="80" cy="30" r="12" fill="#e23b3b" /><circle cx="105" cy="30" r="12" fill="#e23b3b" /><circle cx="130" cy="30" r="12" fill="#e23b3b" /><text x="60" y="65" fill="#333333">5 apples = $2.50</text></svg>',
    },
    {
      question:
        "A car travels 180 miles in 3 hours. What is the unit rate (speed) in miles per hour?",
      expectedAnswer: "60",
      acceptableAnswers: ["60 mph", "60 miles per hour"],
      hint: "Divide the total miles by the total hours.",
      diagramSvg:
        '<svg xmlns="http://www.w3.org/2000/svg" aria-label="unit rate diagram" viewBox="0 0 200 80"><text x="30" y="35" fill="#333333">180 miles</text><text x="120" y="35" fill="#333333">3 hours</text><text x="60" y="60" fill="#666666">miles per hour = ?</text></svg>',
    },
    {
      question:
        "A printer prints 120 pages in 4 minutes. How many pages does it print per minute?",
      expectedAnswer: "30",
      acceptableAnswers: ["30 pages"],
      hint: "Divide total pages by total minutes.",
      diagramSvg:
        '<svg xmlns="http://www.w3.org/2000/svg" aria-label="unit rate diagram" viewBox="0 0 200 80"><text x="30" y="40" fill="#333333">120 pages</text><text x="120" y="40" fill="#333333">4 minutes</text></svg>',
    },
    {
      question:
        "If 8 identical boxes weigh 48 pounds total, what is the weight of one box?",
      expectedAnswer: "6",
      acceptableAnswers: ["6 pounds", "6 lbs"],
      hint: "Divide the total weight by the number of boxes.",
      diagramSvg:
        '<svg xmlns="http://www.w3.org/2000/svg" aria-label="unit rate diagram" viewBox="0 0 200 80"><rect x="20" y="20" width="25" height="25" rx="3" fill="#a8c686" /><rect x="55" y="20" width="25" height="25" rx="3" fill="#a8c686" /><rect x="90" y="20" width="25" height="25" rx="3" fill="#a8c686" /><rect x="125" y="20" width="25" height="25" rx="3" fill="#a8c686" /><text x="50" y="65" fill="#333333">8 boxes = 48 lbs</text></svg>',
    },
    {
      question:
        "Which is the better deal: 3 shirts for $45 or 5 shirts for $60? Enter the cost per shirt for the better deal.",
      expectedAnswer: "12",
      acceptableAnswers: ["$12", "12 dollars"],
      hint: "Find the unit price for each option. The lower price per shirt is the better deal.",
      diagramSvg:
        '<svg xmlns="http://www.w3.org/2000/svg" aria-label="unit rate comparison" viewBox="0 0 200 80"><text x="15" y="30" fill="#333333">3 for $45</text><text x="15" y="55" fill="#333333">5 for $60</text><text x="110" y="42" fill="#666666">Better deal?</text></svg>',
    },
  ],

  percent: [
    {
      question: "What is 25% of 80?",
      expectedAnswer: "20",
      hint: "25% is the same as one-fourth. What is one-fourth of 80?",
      diagramSvg:
        '<svg xmlns="http://www.w3.org/2000/svg" aria-label="percent diagram" viewBox="0 0 200 80"><rect x="20" y="20" width="40" height="40" rx="4" fill="#d4a72c" /><rect x="60" y="20" width="40" height="40" rx="4" fill="#d4a72c" /><rect x="100" y="20" width="40" height="40" rx="4" fill="#d4a72c" /><rect x="140" y="20" width="40" height="40" rx="4" fill="#cccccc" /><text x="70" y="75" fill="#333333">25% of 80</text></svg>',
    },
    {
      question:
        "A shirt costs $40 and is on sale for 20% off. What is the sale price?",
      expectedAnswer: "32",
      acceptableAnswers: ["$32", "32 dollars"],
      hint: "First find 20% of $40 (the discount), then subtract it from $40.",
      diagramSvg:
        '<svg xmlns="http://www.w3.org/2000/svg" aria-label="percent diagram" viewBox="0 0 200 80"><rect x="20" y="20" width="100" height="35" rx="5" fill="#6b9bd8" /><rect x="120" y="20" width="25" height="35" rx="5" fill="#e88b8b" /><text x="45" y="42" fill="#ffffff">80% pay</text><text x="123" y="42" fill="#ffffff">20%</text></svg>',
    },
    {
      question:
        "A student got 18 out of 24 questions correct on a test. What percent did they get correct?",
      expectedAnswer: "75",
      acceptableAnswers: ["75%"],
      hint: "Divide 18 by 24, then multiply by 100 to get the percent.",
      diagramSvg:
        '<svg xmlns="http://www.w3.org/2000/svg" aria-label="percent diagram" viewBox="0 0 200 80"><text x="30" y="35" fill="#333333">18 correct</text><text x="120" y="35" fill="#333333">24 total</text></svg>',
    },
    {
      question:
        "A price increased from $50 to $60. What is the percent increase?",
      expectedAnswer: "20",
      acceptableAnswers: ["20%"],
      hint: "Find the increase ($10), then divide by the original amount ($50).",
      diagramSvg:
        '<svg xmlns="http://www.w3.org/2000/svg" aria-label="percent diagram" viewBox="0 0 200 80"><text x="20" y="35" fill="#333333">was $50</text><text x="110" y="35" fill="#333333">now $60</text><text x="70" y="60" fill="#666666">increase = $10</text></svg>',
    },
    {
      question:
        "A restaurant bill is $80. If you leave a 15% tip, how much is the tip?",
      expectedAnswer: "12",
      acceptableAnswers: ["$12", "12 dollars"],
      hint: "Find 15% of $80. 10% of 80 is 8, and 5% is 4.",
      diagramSvg:
        '<svg xmlns="http://www.w3.org/2000/svg" aria-label="percent diagram" viewBox="0 0 200 80"><text x="30" y="40" fill="#333333">Bill = $80</text><text x="120" y="40" fill="#333333">Tip = 15%?</text></svg>',
    },
  ],

  fractions: [
    {
      question:
        "What is 1/2 divided by 1/4? (Enter as a whole number or fraction like 3/2)",
      expectedAnswer: "2",
      hint: "Dividing by 1/4 is the same as multiplying by 4. So 1/2 times 4 = ?",
      diagramSvg:
        '<svg xmlns="http://www.w3.org/2000/svg" aria-label="fraction diagram" viewBox="0 0 200 80"><rect x="10" y="20" width="80" height="40" rx="4" fill="#8fc9dc" /><line x1="50" y1="20" x2="50" y2="60" stroke="#333333" stroke-width="2" /><text x="30" y="45" fill="#ffffff">1/2</text><rect x="110" y="20" width="40" height="40" rx="4" fill="#d4a72c" /><text x="125" y="45" fill="#333333">1/4</text></svg>',
    },
    {
      question:
        "A pizza is cut into 8 equal slices. If you eat 3 slices, what fraction of the pizza did you eat? (Use the format number/number)",
      expectedAnswer: "3/8",
      hint: "You ate 3 out of 8 slices.",
      diagramSvg:
        '<svg xmlns="http://www.w3.org/2000/svg" aria-label="fraction diagram" viewBox="0 0 200 80"><circle cx="50" cy="40" r="30" fill="#d4a72c" /><line x1="50" y1="10" x2="50" y2="70" stroke="#333333" stroke-width="1" /><line x1="24" y1="25" x2="76" y2="55" stroke="#333333" stroke-width="1" /><line x1="24" y1="55" x2="76" y2="25" stroke="#333333" stroke-width="1" /><line x1="20" y1="40" x2="80" y2="40" stroke="#333333" stroke-width="1" /><text x="130" y="45" fill="#333333">3 of 8 eaten</text></svg>',
    },
    {
      question: "Calculate: 2/3 times 3/4. (Use the format number/number)",
      expectedAnswer: "6/12",
      acceptableAnswers: ["1/2"],
      hint: "Multiply the tops together and the bottoms together. 2x3=6 and 3x4=12.",
      diagramSvg:
        '<svg xmlns="http://www.w3.org/2000/svg" aria-label="fraction diagram" viewBox="0 0 200 80"><text x="30" y="45" fill="#333333">2/3 x 3/4</text></svg>',
    },
    {
      question:
        "A recipe needs 3/4 cup of sugar. If you are making half the recipe, how much sugar do you need? (Use the format number/number)",
      expectedAnswer: "3/8",
      hint: "Half of 3/4 is 3/4 times 1/2.",
      diagramSvg:
        '<svg xmlns="http://www.w3.org/2000/svg" aria-label="fraction diagram" viewBox="0 0 200 80"><rect x="10" y="20" width="60" height="40" rx="4" fill="#d4a72c" /><rect x="70" y="20" width="20" height="40" rx="4" fill="#cccccc" /><text x="20" y="45" fill="#333333">3/4 cup</text><text x="120" y="45" fill="#666666">half = ?</text></svg>',
    },
  ],

  integers: [
    {
      question: "What is -5 + 8?",
      expectedAnswer: "3",
      hint: "Start at -5 and move 8 steps to the right (positive direction).",
      diagramSvg:
        '<svg xmlns="http://www.w3.org/2000/svg" aria-label="number line" viewBox="0 0 200 80"><line x1="10" y1="40" x2="190" y2="40" stroke="#333333" stroke-width="2" /><line x1="50" y1="35" x2="50" y2="45" stroke="#333333" stroke-width="2" /><text x="42" y="60" fill="#333333">-5</text><line x1="130" y1="35" x2="130" y2="45" stroke="#333333" stroke-width="2" /><text x="122" y="60" fill="#333333">+3</text></svg>',
    },
    {
      question: "What is -3 times -4?",
      expectedAnswer: "12",
      hint: "A negative times a negative is positive.",
      diagramSvg:
        '<svg xmlns="http://www.w3.org/2000/svg" aria-label="integer diagram" viewBox="0 0 200 80"><text x="50" y="45" fill="#333333">-3 x -4 = ?</text></svg>',
    },
    {
      question:
        "The temperature was 5 degrees and dropped 12 degrees. What is the new temperature?",
      expectedAnswer: "-7",
      acceptableAnswers: ["-7 degrees"],
      hint: "5 minus 12 = ? If you go below zero, the answer is negative.",
      diagramSvg:
        '<svg xmlns="http://www.w3.org/2000/svg" aria-label="temperature" viewBox="0 0 200 80"><line x1="10" y1="40" x2="190" y2="40" stroke="#333333" stroke-width="2" /><text x="90" y="30" fill="#333333">5 degrees</text><text x="90" y="65" fill="#e23b3b">drops 12</text></svg>',
    },
    {
      question: "What is -10 - (-3)?",
      expectedAnswer: "-7",
      hint: "Subtracting a negative is the same as adding a positive. So -10 + 3 = ?",
      diagramSvg:
        '<svg xmlns="http://www.w3.org/2000/svg" aria-label="integer diagram" viewBox="0 0 200 80"><text x="50" y="45" fill="#333333">-10 - (-3) = ?</text></svg>',
    },
    {
      question:
        "A submarine is at -150 feet. It rises 60 feet. What is its new depth? (Include the negative sign)",
      expectedAnswer: "-90",
      acceptableAnswers: ["-90 feet"],
      hint: "Add 60 to -150. Since you are rising, the number gets less negative.",
      diagramSvg:
        '<svg xmlns="http://www.w3.org/2000/svg" aria-label="depth diagram" viewBox="0 0 200 80"><line x1="100" y1="5" x2="100" y2="75" stroke="#333333" stroke-width="2" /><line x1="40" y1="55" x2="160" y2="55" stroke="#8fc9dc" stroke-width="2" /><text x="110" y="58" fill="#333333">0 sea level</text><text x="110" y="70" fill="#333333">rises 60 ft</text></svg>',
    },
  ],

  expressions: [
    {
      question: "Evaluate 3x + 5 when x = 4.",
      expectedAnswer: "17",
      hint: "Substitute 4 for x: 3(4) + 5 = 12 + 5.",
      diagramSvg:
        '<svg xmlns="http://www.w3.org/2000/svg" aria-label="expression" viewBox="0 0 200 80"><text x="30" y="45" fill="#333333">3(4) + 5 = ?</text></svg>',
    },
    {
      question: "Simplify: 2(x + 3) when x = 5.",
      expectedAnswer: "16",
      hint: "Distribute the 2: 2x5 + 2x3 = 10 + 6.",
      diagramSvg:
        '<svg xmlns="http://www.w3.org/2000/svg" aria-label="expression" viewBox="0 0 200 80"><text x="30" y="45" fill="#333333">2(5 + 3) = ?</text></svg>',
    },
    {
      question:
        "Write the expression for 5 more than twice a number n. (Do not evaluate - write the expression)",
      expectedAnswer: "2n+5",
      acceptableAnswers: ["2n + 5", "5+2n", "5 + 2n", "2*n+5"],
      hint: "Twice a number n is 2n. Five more than that is 2n + 5.",
      diagramSvg:
        '<svg xmlns="http://www.w3.org/2000/svg" aria-label="expression" viewBox="0 0 200 80"><text x="30" y="45" fill="#333333">5 more than 2n</text></svg>',
    },
    {
      question:
        "If a = 2 and b = 3, what is the value of a squared plus b squared?",
      expectedAnswer: "13",
      hint: "2 squared is 4, 3 squared is 9. Add them.",
      diagramSvg:
        '<svg xmlns="http://www.w3.org/2000/svg" aria-label="expression" viewBox="0 0 200 80"><text x="20" y="45" fill="#333333">a=2, b=3: a*a + b*b</text></svg>',
    },
    {
      question:
        "Simplify by combining like terms: 7x - 3x + 2. (Use the format like 4x+2)",
      expectedAnswer: "4x+2",
      acceptableAnswers: ["4x + 2", "2+4x", "2 + 4x"],
      hint: "Combine the x terms: 7x - 3x = 4x. The 2 stays as is.",
      diagramSvg:
        '<svg xmlns="http://www.w3.org/2000/svg" aria-label="expression" viewBox="0 0 200 80"><text x="20" y="45" fill="#333333">7x - 3x + 2 = ?</text></svg>',
    },
  ],

  linear: [
    {
      question: "In the equation y = 2x, what is y when x = 5?",
      expectedAnswer: "10",
      hint: "Multiply 2 times 5.",
      diagramSvg:
        '<svg xmlns="http://www.w3.org/2000/svg" aria-label="linear relationship" viewBox="0 0 100 60"><line x1="10" y1="50" x2="90" y2="50" stroke="#567063" stroke-width="2" /><line x1="20" y1="55" x2="20" y2="10" stroke="#567063" stroke-width="2" /><line x1="20" y1="45" x2="70" y2="15" stroke="#8fc9dc" stroke-width="3" /><text x="72" y="18" fill="#333333">y = 2x</text></svg>',
    },
    {
      question: "In the equation y = 3x, what is y when x = 4?",
      expectedAnswer: "12",
      hint: "Multiply 3 times 4.",
      diagramSvg:
        '<svg xmlns="http://www.w3.org/2000/svg" aria-label="linear relationship" viewBox="0 0 100 60"><line x1="10" y1="50" x2="90" y2="50" stroke="#567063" stroke-width="2" /><line x1="20" y1="55" x2="20" y2="10" stroke="#567063" stroke-width="2" /><line x1="20" y1="45" x2="60" y2="12" stroke="#8fc9dc" stroke-width="3" /><text x="62" y="18" fill="#333333">y = 3x</text></svg>',
    },
    {
      question:
        "A line passes through the points (1, 3) and (2, 6). What is the slope of the line?",
      expectedAnswer: "3",
      hint: "Slope = change in y divided by change in x. (6-3)/(2-1).",
      diagramSvg:
        '<svg xmlns="http://www.w3.org/2000/svg" aria-label="linear relationship" viewBox="0 0 100 60"><line x1="10" y1="50" x2="90" y2="50" stroke="#567063" stroke-width="2" /><line x1="20" y1="55" x2="20" y2="10" stroke="#567063" stroke-width="2" /><circle cx="30" cy="40" r="3" fill="#e23b3b" /><circle cx="45" cy="25" r="3" fill="#e23b3b" /><text x="55" y="20" fill="#333333">(1,3) (2,6)</text></svg>',
    },
    {
      question: "In the equation y = 4x + 1, what is y when x = 2?",
      expectedAnswer: "9",
      hint: "Substitute: 4(2) + 1 = 8 + 1.",
      diagramSvg:
        '<svg xmlns="http://www.w3.org/2000/svg" aria-label="linear relationship" viewBox="0 0 100 60"><line x1="10" y1="50" x2="90" y2="50" stroke="#567063" stroke-width="2" /><line x1="20" y1="55" x2="20" y2="10" stroke="#567063" stroke-width="2" /><line x1="20" y1="45" x2="55" y2="10" stroke="#8fc9dc" stroke-width="3" /><text x="57" y="14" fill="#333333">y = 4x+1</text></svg>',
    },
    {
      question: "If y = 5x and the input x = 3, what is the output y?",
      expectedAnswer: "15",
      hint: "Multiply 5 times 3.",
      diagramSvg:
        '<svg xmlns="http://www.w3.org/2000/svg" aria-label="linear relationship" viewBox="0 0 100 60"><line x1="10" y1="50" x2="90" y2="50" stroke="#567063" stroke-width="2" /><line x1="20" y1="55" x2="20" y2="10" stroke="#567063" stroke-width="2" /><line x1="20" y1="45" x2="50" y2="10" stroke="#8fc9dc" stroke-width="3" /><text x="52" y="14" fill="#333333">y = 5x</text></svg>',
    },
    {
      question:
        "A proportional relationship has a constant of 7. If x = 2, what is y?",
      expectedAnswer: "14",
      hint: "In a proportional relationship y = kx where k is the constant. 7 times 2.",
      diagramSvg:
        '<svg xmlns="http://www.w3.org/2000/svg" aria-label="linear relationship" viewBox="0 0 100 60"><line x1="10" y1="50" x2="90" y2="50" stroke="#567063" stroke-width="2" /><line x1="20" y1="55" x2="20" y2="10" stroke="#567063" stroke-width="2" /><line x1="20" y1="45" x2="45" y2="10" stroke="#8fc9dc" stroke-width="3" /><text x="47" y="14" fill="#333333">y = 7x</text></svg>',
    },
  ],

  equations: [
    {
      question: "Solve for x: x + 7 = 15",
      expectedAnswer: "8",
      hint: "Subtract 7 from both sides.",
      diagramSvg:
        '<svg xmlns="http://www.w3.org/2000/svg" aria-label="equation" viewBox="0 0 200 80"><text x="40" y="45" fill="#333333">x + 7 = 15</text></svg>',
    },
    {
      question: "Solve for x: 2x = 18",
      expectedAnswer: "9",
      hint: "Divide both sides by 2.",
      diagramSvg:
        '<svg xmlns="http://www.w3.org/2000/svg" aria-label="equation" viewBox="0 0 200 80"><text x="40" y="45" fill="#333333">2x = 18</text></svg>',
    },
    {
      question: "Solve for x: 3x - 5 = 16",
      expectedAnswer: "7",
      hint: "First add 5 to both sides (3x = 21), then divide by 3.",
      diagramSvg:
        '<svg xmlns="http://www.w3.org/2000/svg" aria-label="equation" viewBox="0 0 200 80"><text x="30" y="45" fill="#333333">3x - 5 = 16</text></svg>',
    },
    {
      question: "Solve for x: x/4 = 6 (x divided by 4 equals 6)",
      expectedAnswer: "24",
      hint: "Divide both sides by 4.",
      diagramSvg:
        '<svg xmlns="http://www.w3.org/2000/svg" aria-label="equation" viewBox="0 0 200 80"><text x="30" y="45" fill="#333333">x / 4 = 6</text></svg>',
    },
    {
      question: "Solve for x: 5x + 2 = 3x + 14",
      expectedAnswer: "6",
      hint: "Move all x terms to one side and all numbers to the other. 5x - 3x = 14 - 2.",
      diagramSvg:
        '<svg xmlns="http://www.w3.org/2000/svg" aria-label="equation" viewBox="0 0 200 80"><text x="10" y="45" fill="#333333">5x + 2 = 3x + 14</text></svg>',
    },
  ],

  exponents: [
    {
      question: "What is 2 to the power of 3 (two cubed)?",
      expectedAnswer: "8",
      hint: "2 x 2 x 2 = ?",
      diagramSvg:
        '<svg xmlns="http://www.w3.org/2000/svg" aria-label="exponent" viewBox="0 0 200 80"><text x="50" y="45" fill="#333333">2 x 2 x 2 = ?</text></svg>',
    },
    {
      question: "What is 5 squared (5 to the power of 2)?",
      expectedAnswer: "25",
      hint: "5 x 5 = ?",
      diagramSvg:
        '<svg xmlns="http://www.w3.org/2000/svg" aria-label="exponent" viewBox="0 0 200 80"><rect x="20" y="15" width="25" height="25" rx="3" fill="#d4a72c" /><rect x="45" y="15" width="25" height="25" rx="3" fill="#d4a72c" /><rect x="20" y="40" width="25" height="25" rx="3" fill="#d4a72c" /><rect x="45" y="40" width="25" height="25" rx="3" fill="#d4a72c" /><rect x="70" y="15" width="25" height="25" rx="3" fill="#d4a72c" /><rect x="95" y="15" width="25" height="25" rx="3" fill="#d4a72c" /><rect x="70" y="40" width="25" height="25" rx="3" fill="#d4a72c" /><rect x="95" y="40" width="25" height="25" rx="3" fill="#d4a72c" /><text x="140" y="45" fill="#333333">5 x 5</text></svg>',
    },
    {
      question: "What is 10 to the power of 4?",
      expectedAnswer: "10000",
      acceptableAnswers: ["10,000"],
      hint: "10 x 10 x 10 x 10. Add four zeros to 1.",
      diagramSvg:
        '<svg xmlns="http://www.w3.org/2000/svg" aria-label="exponent" viewBox="0 0 200 80"><text x="30" y="45" fill="#333333">10 x 10 x 10 x 10</text></svg>',
    },
    {
      question: "Simplify: 3 to the power of 2 times 3 to the power of 3.",
      expectedAnswer: "243",
      hint: "When multiplying with the same base, add the exponents. 3 to the power of 5.",
      diagramSvg:
        '<svg xmlns="http://www.w3.org/2000/svg" aria-label="exponent" viewBox="0 0 200 80"><text x="20" y="45" fill="#333333">3^2 x 3^3 = 3^5</text></svg>',
    },
    {
      question: "What is 1 to the power of 100?",
      expectedAnswer: "1",
      hint: "1 multiplied by itself any number of times is always 1.",
      diagramSvg:
        '<svg xmlns="http://www.w3.org/2000/svg" aria-label="exponent" viewBox="0 0 200 80"><text x="40" y="45" fill="#333333">1 x 1 x ... = ?</text></svg>',
    },
  ],

  "square-roots": [
    {
      question: "What is the square root of 49?",
      expectedAnswer: "7",
      hint: "What number times itself equals 49?",
      diagramSvg:
        '<svg xmlns="http://www.w3.org/2000/svg" aria-label="square root" viewBox="0 0 200 80"><rect x="20" y="15" width="30" height="30" rx="3" fill="#8fc9dc" /><rect x="50" y="15" width="30" height="30" rx="3" fill="#8fc9dc" /><rect x="20" y="45" width="30" height="30" rx="3" fill="#8fc9dc" /><rect x="50" y="45" width="30" height="30" rx="3" fill="#8fc9dc" /><text x="100" y="50" fill="#333333">? x ? = 49</text></svg>',
    },
    {
      question: "What is the square root of 144?",
      expectedAnswer: "12",
      hint: "What number times itself equals 144? Think of 10x10=100, 11x11=121, 12x12=144.",
      diagramSvg:
        '<svg xmlns="http://www.w3.org/2000/svg" aria-label="square root" viewBox="0 0 200 80"><text x="40" y="45" fill="#333333">12 x 12 = 144</text></svg>',
    },
    {
      question: "What is the square root of 81?",
      expectedAnswer: "9",
      hint: "What number times itself equals 81?",
      diagramSvg:
        '<svg xmlns="http://www.w3.org/2000/svg" aria-label="square root" viewBox="0 0 200 80"><text x="40" y="45" fill="#333333">? x ? = 81</text></svg>',
    },
    {
      question:
        "Between which two whole numbers does the square root of 30 fall? Enter the smaller number.",
      expectedAnswer: "5",
      hint: "5 squared is 25 and 6 squared is 36. The square root of 30 is between them.",
      diagramSvg:
        '<svg xmlns="http://www.w3.org/2000/svg" aria-label="square root" viewBox="0 0 200 80"><line x1="10" y1="40" x2="190" y2="40" stroke="#333333" stroke-width="2" /><text x="30" y="60" fill="#333333">25</text><text x="80" y="60" fill="#333333">30</text><text x="130" y="60" fill="#333333">36</text></svg>',
    },
    {
      question: "What is the square root of 225?",
      expectedAnswer: "15",
      hint: "15 x 15 = 225.",
      diagramSvg:
        '<svg xmlns="http://www.w3.org/2000/svg" aria-label="square root" viewBox="0 0 200 80"><text x="40" y="45" fill="#333333">15 x 15 = 225</text></svg>',
    },
  ],

  functions: [
    {
      question: "If f(x) = 2x + 3, what is f(4)?",
      expectedAnswer: "11",
      hint: "Replace x with 4: 2(4) + 3 = 8 + 3.",
      diagramSvg:
        '<svg xmlns="http://www.w3.org/2000/svg" aria-label="function" viewBox="0 0 200 80"><text x="20" y="40" fill="#333333">input: 4</text><rect x="80" y="20" width="40" height="40" rx="6" fill="#a8c686" /><text x="85" y="45" fill="#333333">f(x)</text><text x="140" y="40" fill="#333333">output: ?</text></svg>',
    },
    {
      question: "If f(x) = x squared, what is f(5)?",
      expectedAnswer: "25",
      hint: "Replace x with 5: 5 x 5 = ?",
      diagramSvg:
        '<svg xmlns="http://www.w3.org/2000/svg" aria-label="function" viewBox="0 0 200 80"><text x="20" y="40" fill="#333333">input: 5</text><rect x="80" y="20" width="40" height="40" rx="6" fill="#a8c686" /><text x="82" y="45" fill="#333333">x*x</text><text x="140" y="40" fill="#333333">output: ?</text></svg>',
    },
    {
      question: "If g(x) = 3x - 1, what is g(2)?",
      expectedAnswer: "5",
      hint: "Replace x with 2: 3(2) - 1 = 6 - 1.",
      diagramSvg:
        '<svg xmlns="http://www.w3.org/2000/svg" aria-label="function" viewBox="0 0 200 80"><text x="20" y="40" fill="#333333">input: 2</text><rect x="80" y="20" width="40" height="40" rx="6" fill="#a8c686" /><text x="80" y="45" fill="#333333">3x-1</text><text x="140" y="40" fill="#333333">output: ?</text></svg>',
    },
    {
      question:
        "A function machine takes a number, doubles it, then adds 4. If the input is 6, what is the output?",
      expectedAnswer: "16",
      hint: "Double 6 to get 12, then add 4.",
      diagramSvg:
        '<svg xmlns="http://www.w3.org/2000/svg" aria-label="function machine" viewBox="0 0 200 80"><text x="10" y="40" fill="#333333">6</text><rect x="40" y="20" width="50" height="40" rx="6" fill="#a8c686" /><text x="50" y="45" fill="#333333">x2+4</text><text x="110" y="40" fill="#333333">= ?</text></svg>',
    },
    {
      question: "If f(x) = 10 - 2x, what is f(3)?",
      expectedAnswer: "4",
      hint: "Replace x with 3: 10 - 2(3) = 10 - 6.",
      diagramSvg:
        '<svg xmlns="http://www.w3.org/2000/svg" aria-label="function" viewBox="0 0 200 80"><text x="20" y="40" fill="#333333">input: 3</text><rect x="80" y="20" width="40" height="40" rx="6" fill="#a8c686" /><text x="80" y="45" fill="#333333">10-2x</text><text x="140" y="40" fill="#333333">output: ?</text></svg>',
    },
  ],
};
