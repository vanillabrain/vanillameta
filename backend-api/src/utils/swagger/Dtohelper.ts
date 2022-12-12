import { OpenAPIObject } from '@nestjs/swagger';
import { ComponentsObject } from '@nestjs/swagger/dist/interfaces/open-api-spec.interface';

const arrayIntersect = (array1: string[], array2: string[]): string[] => array1.filter((item) => array2.includes(item));

export const filterDocumentsDtoPathsByTags = (publicDocument: OpenAPIObject): ComponentsObject => {
    const result: ComponentsObject = {};

    const tags = publicDocument.tags.map(({ name }) => name);       // 모든 tage의 이름
    console.log(tags)
    for (const path of Object.keys(publicDocument.paths)) {
        const pathMethods = {};

        for (const method of Object.keys(publicDocument.paths[path])) {
            const endpointTags = publicDocument.paths[path][method].tags; //addTag로 경로 설정한 테그이름

            if (!Array.isArray(endpointTags)) {
                continue;
            }

            if (arrayIntersect(tags, endpointTags).length > 0) {
                pathMethods[method] = publicDocument.paths[path][method];   // 모든 tag의 이름과 경로 설정한 테그이름이 같은것.
            }
        }
        console.log(result)
        result[path] = pathMethods;
    }

    return result;
};