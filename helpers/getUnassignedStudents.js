function getUnassignedStudents(students)
{
    let unAssignedStudents = [];
    for (let i = 0; i < students.length; i++)
    {
        if (students[i].mentor_id == "")
            unAssignedStudents.push(students[i].student_id);
    }

    return unAssignedStudents;
}

module.exports.getUnassignedStudents = getUnassignedStudents;