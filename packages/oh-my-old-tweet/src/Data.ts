import Post from "./Post";
import User from "./User";

type Data = {
    name: string;
    title: string;
    user: string;
    image_paths: string[];
}

export function getPosts(limit: number): Promise<Post[]> {
    const url = "http://localhost:5000/status/all"
    const req = `${url}/${limit}`
    return getData(req)
}

export function getPostsByUser(id: string) {
    const url = "http://localhost:5000/status/user"
    const req = `${url}/${id}`
    return getData(req)
}

function getData(req: string) {
    return fetch(req)
        .then(res => res.json())
        .then(j => {
            let data = j as [Data]
            return data.map(i => new Post(new User(i.name, undefined), i.title, 
                i.image_paths.map(p => {
                    // console.log(p)
                    return new URL(`http://localhost:5000${p}`) })))
        })
}