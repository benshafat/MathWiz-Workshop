# Helpful prompts for the workshop

## Infra Plan Prompt

We want to build a simple system that allows the user to explore different properties of numbers in number theory. 

- In `fun_math.md` you will find a list of several such properties. 
- We want to have 
  1. a UI that gives us a nice menu to choose these from (perhaps a button for each, since there are only a handful), and 
  2. an infrastructure (backend) that can support them all. 

In `infra_plans.md`, please lay out your plan for the infrastructure we need to build to support this. Have a "Backend" and a "Frontend" section, where you detail in each what is needed. 

### Implementation details
- We will be using python for backend, html/js/ts for the frontend. I think FastAPI is a good API package. 
- Let's use uv for package management. 
- We want to keep it simple - this is for internal use at the moment, not for production-grade. So you can use packages that give nice results even if they are not recommended for high scale/load.
- All code runs locally for the workshop. Do not add any authentication, authorization, HTTPS, or other security hardening. This also means CORS can be fully open (`*`) and input validation only needs to be enough to prevent crashes, not to guard against malicious input.


## Math Examples - Expansion
Next, for each of the Math examples in `fun_math.md`, create a dedicated `.md` file in the `plans` folder, with details on how you will implement this. 

- Make sure each has info both on the math and on the visualization. 
- Rely on the `infra_plan.md` file to determine which packages to use. If you think a package should be added, update the `infra_plan.md` with this info so this is available to other functions we explore.
- If there are MCPs that can be used here for better experience, mention them as suggestions.
- You can add additional options for visualizations in your per-example file. 
- Finally, if there are key implementation questions that you have that will impact how the backend/visuals are done for that math thing, add a section of "Open questions - resolve before implementing" at the end, and put them there.