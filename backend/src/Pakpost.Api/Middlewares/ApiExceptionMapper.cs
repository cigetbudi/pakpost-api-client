using System.Net;
using FluentValidation;
using Microsoft.EntityFrameworkCore;
using Npgsql;
using Pakpost.Application.Common.Exceptions;

namespace Pakpost.Api.Middlewares;

// Pure, testable mapping of known exceptions to safe public HTTP payloads.
// Do not place exception.Message in unexpected error responses.
internal static class ApiExceptionMapper
{
    internal static (int StatusCode, object Response) MapException(Exception exception)
    {
        return exception switch
        {
            ValidationException validation => (
                (int)HttpStatusCode.BadRequest,
                new
                {
                    message = "Validation failed",
                    errors = validation.Errors.Select(error => new
                    {
                        field = error.PropertyName,
                        message = error.ErrorMessage
                    })
                }),

            AppException application => (
                application.StatusCode,
                new { message = application.Message }),

            DbUpdateConcurrencyException => (
                (int)HttpStatusCode.Conflict,
                new { message = "Resource changed; refresh and retry" }),

            _ when IsDatabaseConflict(exception) => (
                (int)HttpStatusCode.Conflict,
                new { message = "Database conflict; refresh and retry" }),

            _ when IsTemporaryDatabaseFailure(exception) => (
                (int)HttpStatusCode.ServiceUnavailable,
                new { message = "Database temporarily unavailable; retry shortly" }),

            _ when exception is TimeoutException || GetSqlState(exception) == "57014" => (
                (int)HttpStatusCode.GatewayTimeout,
                new { message = "Request timed out" }),

            _ => (
                (int)HttpStatusCode.InternalServerError,
                new { message = "Internal server error" })
        };
    }

    internal static bool IsTemporaryDatabaseFailure(Exception exception)
    {
        if (IsDatabaseConflict(exception))
            return false;

        return exception switch
        {
            DbUpdateException { InnerException: { } inner } => IsTemporaryDatabaseFailure(inner),
            PostgresException postgres =>
                postgres.SqlState.StartsWith("08", StringComparison.Ordinal) ||
                postgres.SqlState is "53300" or "53400" or "57P01" or "57P02" or "57P03",
            NpgsqlException => true,
            _ => false
        };
    }

    internal static bool IsDatabaseConflict(Exception exception) =>
        GetSqlState(exception) is "23503" or "23505" or "40001" or "40P01";

    internal static string? GetSqlState(Exception exception) => exception switch
    {
        PostgresException postgres => postgres.SqlState,
        DbUpdateException { InnerException: PostgresException inner } => inner.SqlState,
        _ => null
    };
}
