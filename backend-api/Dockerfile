FROM node:14-slim
# ORACLE 설치
RUN apt-get update && apt-get install -y libaio1 wget unzip
WORKDIR /opt/oracle
RUN wget https://download.oracle.com/otn_software/linux/instantclient/instantclient-basiclite-linuxx64.zip && \
    unzip instantclient-basiclite-linuxx64.zip && rm -f instantclient-basiclite-linuxx64.zip && \
    cd /opt/oracle/instantclient* && rm -f *jdbc* *occi* *mysql* *mql1* *ipc1* *jar uidrvci genezi adrci && \
    echo /opt/oracle/instantclient* > /etc/ld.so.conf.d/oracle-instantclient.conf && ldconfig
WORKDIR /app
# ENV NODE_ENV production
# COPY --from=builder /app ./
COPY . .
RUN npm install
RUN npm run build

# expose our default runtime port
EXPOSE 4000

CMD ["npm","run","start:prod"]