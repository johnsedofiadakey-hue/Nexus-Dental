const { prisma } = require('../src/lib/db/prisma');

async function main() {
    try {
        const users = await prisma.user.findMany({
            select: {
                email: true,
                role: true,
                status: true,
                tenantId: true
            }
        });
        console.log('--- USER AUDIT ---');
        console.log(JSON.stringify(users, null, 2));
    } catch (error) {
        console.error('Audit failed:', error);
    } finally {
        await prisma.$disconnect();
    }
}

main();
