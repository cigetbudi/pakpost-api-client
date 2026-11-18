using System.Net;
using FluentValidation;
using Microsoft.EntityFrameworkCore;
using Npgsql;
using Pakpost.Application.Common.Exceptions;

namespace Pakpost.Api.Middlewares;

public sealed class GlobalExceptionMiddleware(
    RequestDelegate next,
    ILogger<GlobalExceptionMiddleware> logger)
{
    public async Task InvokeAsync(HttpContext context)
    {
        try
        {
            await next(context);
        }
        catch (OperationCanceledException) when (context.RequestAborted.IsCancellationRequested)
        {
        }
        catch (Exception ex)
        {
            if (context.Response.HasStarted)
            {
                logger.LogError(ex, "Request failed after the response started");
                throw;
            }

            var (statusCode, response) = MapException(ex);

            if (ex is DbUpdateConcurrencyException)
            {
                logger.LogWarning(ex, "Concurrent update conflict");
            }
            else if (ex is DbUpdateException { InnerException: PostgresException { SqlState: "23505" } })
            {
                logger.LogWarning(ex, "Unique constraint conflict");
            }
            else if (ex is not ValidationException and not AppException)
            {
                logger.LogError(ex, "Unhandled request error");
            }

            context.Response.StatusCode = statusCode;
            await context.Response.WriteAsJsonAsync(response);
        }
    }

    private static (int StatusCode, object Response) MapException(Exception exception)
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

            DbUpdateException { InnerException: PostgresException { SqlState: "23505" } } => (
                (int)HttpStatusCode.Conflict,
                new { message = "Database conflict" }),

            _ => (
                (int)HttpStatusCode.InternalServerError,
                new { message = "Internal server error" })
        };
    }
}
