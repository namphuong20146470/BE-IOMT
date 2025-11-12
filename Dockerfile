FROM mcr.microsoft.com/windows/servercore:ltsc2019

# Cài Node.js 18.20.3 (bản mới nhất 18.x)
ADD https://nodejs.org/dist/v18.20.3/node-v18.20.3-win-x64.zip C:/nodejs.zip
RUN powershell -Command "Expand-Archive -Path C:/nodejs.zip -DestinationPath C:/nodejs; Remove-Item C:/nodejs.zip"
ENV PATH="C:/nodejs/node-v18.20.3-win-x64;%PATH%"

WORKDIR C:/app

COPY package*.json ./
RUN npm install

COPY . .

EXPOSE 3030

CMD ["node", "index.js"]