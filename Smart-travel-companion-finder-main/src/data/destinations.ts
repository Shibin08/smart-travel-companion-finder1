export interface Destination {
    id: string;
    name: string;
    image: string;
    description: string;
    properties: string[];
}

export const destinations: Destination[] = [
    {
        id: 'goa',
        name: 'Goa',
        image: 'https://images.unsplash.com/photo-1512343879784-a960bf40e7f2?auto=format&fit=crop&q=80&w=400',
        description: 'Sun, sand, and parties.',
        properties: ['Beach', 'Nightlife', 'Relax']
    },
    {
        id: 'manali',
        name: 'Manali',
        image: 'https://images.unsplash.com/photo-1626621341517-bbf3d9990a23?auto=format&fit=crop&q=80&w=400',
        description: 'Snow-capped peaks and adventure.',
        properties: ['Mountain', 'Adventure', 'Snow']
    },
    {
        id: 'kerala',
        name: 'Kerala',
        image: 'https://images.unsplash.com/photo-1602216056096-3b40cc0c9944?auto=format&fit=crop&q=80&w=400',
        description: 'God\'s own country with backwaters.',
        properties: ['Nature', 'Relax', 'Culture']
    },
    {
        id: 'rishikesh',
        name: 'Rishikesh',
        image: 'https://images.unsplash.com/photo-1588416936097-41850ab3d86d?auto=format&fit=crop&q=80&w=400',
        description: 'Yoga capital and rafting adventure.',
        properties: ['Spiritual', 'Adventure', 'River']
    },
    {
        id: 'jaipur',
        name: 'Jaipur',
        image: 'https://images.unsplash.com/photo-1477587458883-47145ed94245?auto=format&fit=crop&q=80&w=400',
        description: 'The Pink City with royal palaces.',
        properties: ['History', 'Culture', 'Architecture']
    },
    {
        id: 'ladakh',
        name: 'Ladakh',
        image: 'https://images.unsplash.com/photo-1581793745862-99fde7fa73d2?q=80&w=1170&auto=format&fit=crop&ixlib=rb-4.1.0&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D',
        description: 'High passes and stark beauty.',
        properties: ['Adventure', 'Mountain', 'Roadtrip']
    },
    {
        id: 'coorg',
        name: 'Coorg',
        image: 'https://images.unsplash.com/photo-1560357647-62a43d9897bb?q=80&w=1074&auto=format&fit=crop&ixlib=rb-4.1.0&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D',
        description: 'Scotland of India, coffee and hills.',
        properties: ['Nature', 'Hill Station', 'Coffee']
    },
    {
        id: 'andaman',
        name: 'Andaman',
        image: 'https://images.unsplash.com/photo-1545762374-d18079617da8?w=600&auto=format&fit=crop&q=60&ixlib=rb-4.1.0&ixid=M3wxMjA3fDB8MHxzZWFyY2h8Mnx8YW5kYW1hbnxlbnwwfHwwfHx8MA%3D%3D',
        description: 'Pristine beaches and coral reefs.',
        properties: ['Beach', 'Diving', 'Island']
    },
    {
        id: 'pondicherry',
        name: 'Pondicherry',
        image: 'https://images.unsplash.com/photo-1582510003544-4d00b7f74220?auto=format&fit=crop&q=80&w=400',
        description: 'French colonial charm and serene beaches.',
        properties: ['Beach', 'Culture', 'Heritage']
    }
];
