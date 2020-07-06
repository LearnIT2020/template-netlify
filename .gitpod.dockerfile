FROM gitpod/workspace-full

RUN ["npm", "install", "-g", "http-server"]
RUN ["npm", "install", "-g", "vercel"]
RUN ["npm", "install", "-g", "netlify-lambda"]

USER gitpod
